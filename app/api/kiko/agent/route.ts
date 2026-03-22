import { googleAI } from "@genkit-ai/googleai"
import { genkit } from "genkit"
import { NextRequest } from "next/server"
import fs from "node:fs/promises"
import path from "node:path"
import { getAuth } from "firebase-admin/auth"
import {
  type CollectionReference,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type WhereFilterOp,
} from "firebase-admin/firestore"

import { getFirebaseAdminApp, getFirebaseAdminDb } from "@/lib/firebase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type AgentMode = "chat" | "agent"

type AgentRequest = {
  mode?: AgentMode
  model?: string
  message: string
  history?: Array<{ role: "user" | "assistant"; content: string }>
}

type ToolCall = {
  name: string
  input?: Record<string, unknown>
}

type AgentStep =
  | { action: "final"; response: string }
  | { action: "tool"; tool: ToolCall }

type ModelProvider = "gemini" | "ollama"

type ResolvedModel = {
  provider: ModelProvider
  model: string
}

type AgentUserContext = {
  uid: string | null
}

const ai = genkit({
  plugins: [googleAI()],
})

const WORKSPACE_ROOT = process.cwd()
const MAX_FILE_BYTES = 100_000
const DEFAULT_AGENT_ITERATIONS = 3
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash"
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b"
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "")
const OLLAMA_API_KEY = (process.env.OLLAMA_API_KEY || "").trim()
const OLLAMA_AUTH_HEADER = (process.env.OLLAMA_AUTH_HEADER || "Authorization").trim()
const OLLAMA_AUTH_SCHEME = (process.env.OLLAMA_AUTH_SCHEME || "Bearer").trim()

function getOllamaHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }

  if (!OLLAMA_API_KEY) {
    return headers
  }

  headers[OLLAMA_AUTH_HEADER] = OLLAMA_AUTH_SCHEME
    ? `${OLLAMA_AUTH_SCHEME} ${OLLAMA_API_KEY}`
    : OLLAMA_API_KEY

  return headers
}

function resolveRequestedModel(requestedModel?: string): ResolvedModel {
  const raw = (requestedModel || "").trim()

  if (raw.startsWith("ollama:")) {
    return { provider: "ollama", model: raw.replace(/^ollama:/, "") || DEFAULT_OLLAMA_MODEL }
  }

  if (raw.startsWith("gemini:")) {
    return { provider: "gemini", model: raw.replace(/^gemini:/, "") || DEFAULT_GEMINI_MODEL }
  }

  if (raw.length > 0) {
    return { provider: "gemini", model: raw }
  }

  return { provider: "gemini", model: DEFAULT_GEMINI_MODEL }
}

function getIterationLimit(mode: AgentMode): number {
  if (mode === "chat") {
    return 1
  }

  const configured = Number(process.env.KIKO_AGENT_MAX_ITERATIONS ?? DEFAULT_AGENT_ITERATIONS)
  if (!Number.isFinite(configured) || configured < 1) {
    return DEFAULT_AGENT_ITERATIONS
  }

  return Math.min(6, Math.floor(configured))
}

function extractRetryDelaySeconds(message: string): number | null {
  const retryMatch = message.match(/retry in\s+([\d.]+)s/i)
  if (!retryMatch?.[1]) {
    return null
  }

  const seconds = Number(retryMatch[1])
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null
  }

  return Math.ceil(seconds)
}

function formatModelError(error: unknown, provider: ModelProvider): string {
  const raw = error instanceof Error ? error.message : "Unknown model error"
  const lower = raw.toLowerCase()

  if (provider === "ollama") {
    if (lower.includes("fetch failed") || lower.includes("econnrefused") || lower.includes("connect")) {
      return `Ollama is not reachable at ${OLLAMA_BASE_URL}. Start Ollama and try again.`
    }

    return `Ollama request failed: ${raw.slice(0, 240)}`
  }

  if (lower.includes("429") || lower.includes("quota") || lower.includes("rate") || lower.includes("too many requests")) {
    const retryAfter = extractRetryDelaySeconds(raw)
    if (retryAfter) {
      return `Gemini rate limit reached. Please wait about ${retryAfter} seconds and try again.`
    }

    return "Gemini quota/rate limit reached. Check API plan/billing and try again later."
  }

  if (lower.includes("api key") || lower.includes("permission") || lower.includes("unauthorized")) {
    return "Gemini authentication failed. Verify GEMINI_API_KEY/GOOGLE_API_KEY and project permissions."
  }

  return `Model request failed: ${raw.slice(0, 240)}`
}

async function generateWithSelectedModel(prompt: string, selectedModel: ResolvedModel): Promise<string> {
  if (selectedModel.provider === "ollama") {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: getOllamaHeaders(),
      body: JSON.stringify({
        model: selectedModel.model,
        prompt,
        stream: false,
        options: { temperature: 0.2 },
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from Ollama`) 
    }

    const payload = (await response.json()) as { response?: string; error?: string }
    if (payload.error) {
      throw new Error(payload.error)
    }

    return String(payload.response || "")
  }

  const generated = await (ai as any).generate({
    model: googleAI.model(selectedModel.model),
    prompt,
    config: { temperature: 0.2 },
  })

  return getTextFromGenerateResponse(generated)
}

async function generateAgentStepWithSelectedModel(
  prompt: string,
  selectedModel: ResolvedModel,
): Promise<{ step: AgentStep | null; modelText: string }> {
  if (selectedModel.provider === "ollama") {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: getOllamaHeaders(),
      body: JSON.stringify({
        model: selectedModel.model,
        prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.1 },
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from Ollama`)
    }

    const payload = (await response.json()) as { response?: string; error?: string }
    if (payload.error) {
      throw new Error(payload.error)
    }

    const modelText = String(payload.response || "").trim()
    return {
      step: parseAgentStep(modelText),
      modelText,
    }
  }

  const modelText = (await generateWithSelectedModel(prompt, selectedModel)).trim()
  return {
    step: parseAgentStep(modelText),
    modelText,
  }
}

async function streamFinalTextWithOllama(
  prompt: string,
  selectedModel: ResolvedModel,
  onText: (fullText: string) => void,
): Promise<string> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: getOllamaHeaders(),
    body: JSON.stringify({
      model: selectedModel.model,
      prompt,
      stream: true,
      options: { temperature: 0.2 },
    }),
  })

  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} from Ollama stream`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let fullText = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const raw = line.trim()
      if (!raw) {
        continue
      }

      let event: { response?: string; error?: string; done?: boolean }
      try {
        event = JSON.parse(raw) as { response?: string; error?: string; done?: boolean }
      } catch {
        continue
      }

      if (event.error) {
        throw new Error(event.error)
      }

      if (event.response) {
        fullText += event.response
        onText(fullText)
      }

      if (event.done) {
        return fullText.trim()
      }
    }
  }

  return fullText.trim()
}

function createStreamResponse(
  writer: (emit: (event: Record<string, unknown>) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      try {
        await writer(emit)
      } catch (error) {
        emit({
          type: "error",
          message: formatModelError(error, "gemini"),
        })
      } finally {
        emit({ type: "done" })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

function isPathInsideWorkspace(targetPath: string): boolean {
  const relative = path.relative(WORKSPACE_ROOT, targetPath)
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
}

function resolveWorkspacePath(inputPath: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, inputPath)
  if (!isPathInsideWorkspace(resolved)) {
    throw new Error("Path is outside the workspace")
  }

  if (resolved.includes(`${path.sep}.git${path.sep}`) || resolved.includes(`${path.sep}.next${path.sep}`)) {
    throw new Error("Path is blocked")
  }

  return resolved
}

async function readProjectFile(input: Record<string, unknown> = {}) {
  const filePath = String(input.filePath ?? "")
  const startLine = Number(input.startLine ?? 1)
  const endLine = Number(input.endLine ?? Number.MAX_SAFE_INTEGER)

  if (!filePath) {
    throw new Error("filePath is required")
  }

  const resolved = resolveWorkspacePath(filePath)
  const fileBuffer = await fs.readFile(resolved)

  if (fileBuffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("File too large for direct tool read. Narrow the range.")
  }

  const text = fileBuffer.toString("utf8")
  const lines = text.split(/\r?\n/)
  const from = Math.max(1, startLine)
  const to = Math.max(from, Math.min(lines.length, endLine))
  const selected = lines.slice(from - 1, to)

  return {
    filePath,
    startLine: from,
    endLine: to,
    content: selected.join("\n"),
  }
}

async function editProjectFile(input: Record<string, unknown> = {}) {
  const filePath = String(input.filePath ?? "")
  const findText = String(input.findText ?? "")
  const replaceText = String(input.replaceText ?? "")

  if (!filePath || !findText) {
    throw new Error("filePath and findText are required")
  }

  const resolved = resolveWorkspacePath(filePath)
  const current = await fs.readFile(resolved, "utf8")

  if (!current.includes(findText)) {
    throw new Error("findText not found in target file")
  }

  const updated = current.replace(findText, replaceText)
  await fs.writeFile(resolved, updated, "utf8")

  return {
    filePath,
    changed: true,
    message: "File updated successfully",
  }
}

async function runActionCommand(input: Record<string, unknown> = {}) {
  const command = String(input.command ?? "").toLowerCase()
  const textInput = String(input.text ?? "")
  const filePath = String(input.filePath ?? "")
  const sourceText = filePath ? (await readProjectFile({ filePath })).content : textInput

  if (!command) {
    throw new Error("command is required")
  }

  switch (command) {
    case "word_count": {
      const count = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0
      return { command, result: count }
    }
    case "line_count": {
      const count = sourceText.length === 0 ? 0 : sourceText.split(/\r?\n/).length
      return { command, result: count }
    }
    case "sum_numbers": {
      const numbers = (sourceText.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
      const total = numbers.reduce((sum, value) => sum + value, 0)
      return { command, result: total, count: numbers.length }
    }
    case "extract_emails": {
      const emails = Array.from(new Set(sourceText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []))
      return { command, result: emails, count: emails.length }
    }
    default:
      throw new Error(`Unsupported command: ${command}`)
  }
}

function normalizeFirestorePath(pathInput: string): string {
  const clean = pathInput.trim().replace(/^\/+|\/+$/g, "")
  if (!clean) {
    throw new Error("Firestore path is required")
  }
  return clean
}

async function firebaseRead(input: Record<string, unknown> = {}) {
  const rawPath = String(input.path ?? "")
  const limit = Math.max(1, Math.min(20, Number(input.limit ?? 10)))
  const firestorePath = normalizeFirestorePath(rawPath)
  const db = getFirebaseAdminDb()

  const segments = firestorePath.split("/")

  if (segments.length % 2 === 0) {
    const docRef = db.doc(firestorePath)
    const snapshot = await docRef.get()
    return {
      type: "document",
      path: firestorePath,
      exists: snapshot.exists,
      data: snapshot.exists ? snapshot.data() : null,
    }
  }

  const collectionRef = db.collection(firestorePath)
  const snapshots = await collectionRef.limit(limit).get()

  return {
    type: "collection",
    path: firestorePath,
    count: snapshots.size,
    docs: snapshots.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })),
  }
}

async function firebaseWrite(input: Record<string, unknown> = {}) {
  const rawPath = String(input.path ?? "")
  const data = input.data
  const merge = Boolean(input.merge ?? true)
  const firestorePath = normalizeFirestorePath(rawPath)

  if (!data || typeof data !== "object") {
    throw new Error("data object is required")
  }

  const segments = firestorePath.split("/")
  if (segments.length % 2 !== 0) {
    throw new Error("path must target a document (collection/doc)")
  }

  const db = getFirebaseAdminDb()
  await db.doc(firestorePath).set(data as Record<string, unknown>, { merge })

  return {
    path: firestorePath,
    merge,
    saved: true,
  }
}

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization")
  if (!authHeader) {
    return null
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

async function resolveUserContext(request: NextRequest): Promise<AgentUserContext> {
  const token = extractBearerToken(request)
  if (!token) {
    return { uid: null }
  }

  try {
    const decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(token)
    return { uid: decoded.uid || null }
  } catch {
    return { uid: null }
  }
}

function resolveUserScopedPath(rawPath: string, uid: string): string {
  const trimmed = (rawPath || "").trim().replace(/^\/+|\/+$/g, "")
  if (!trimmed) {
    return `users/${uid}`
  }

  const clean = normalizeFirestorePath(trimmed)

  if (clean.startsWith("users/")) {
    const segments = clean.split("/")
    if (segments[1] !== uid) {
      throw new Error("Access denied for requested user path")
    }
    return clean
  }

  return `users/${uid}/${clean}`
}

async function firebaseListUserData(
  _input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  if (!context.uid) {
    throw new Error("Sign in is required to inspect user Firebase data")
  }

  const db = getFirebaseAdminDb()
  const userDocRef = db.collection("users").doc(context.uid)
  const [userDoc, subcollections] = await Promise.all([
    userDocRef.get(),
    userDocRef.listCollections(),
  ])

  return {
    uid: context.uid,
    userDocPath: userDocRef.path,
    userDocExists: userDoc.exists,
    userDocData: userDoc.exists ? userDoc.data() : null,
    collections: subcollections.map((collection: CollectionReference<DocumentData>) => collection.id),
  }
}

async function firebaseReadForUser(
  input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  if (!context.uid) {
    throw new Error("Sign in is required to read user Firebase data")
  }

  const pathInput = String(input.path ?? "transactions")
  const scopedPath = resolveUserScopedPath(pathInput, context.uid)
  return firebaseRead({ ...input, path: scopedPath })
}

async function firebaseWriteForUser(
  input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  if (!context.uid) {
    throw new Error("Sign in is required to write user Firebase data")
  }

  const pathInput = String(input.path ?? "")
  const scopedPath = resolveUserScopedPath(pathInput, context.uid)
  return firebaseWrite({ ...input, path: scopedPath })
}

async function firebaseCreateUserRecord(
  input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  if (!context.uid) {
    throw new Error("Sign in is required to create user Firebase records")
  }

  const collection = String(input.collection ?? "").trim().replace(/^\/+|\/+$/g, "")
  const data = input.data
  const docId = String(input.docId ?? "").trim()

  if (!collection) {
    throw new Error("collection is required")
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("data object is required")
  }

  const db = getFirebaseAdminDb()
  const collectionRef = db.collection("users").doc(context.uid).collection(collection)
  const payload = {
    ...(data as Record<string, unknown>),
    updatedAt: new Date().toISOString(),
  }

  if (docId) {
    await collectionRef.doc(docId).set(payload, { merge: true })
    return {
      uid: context.uid,
      collection,
      docId,
      created: true,
      merge: true,
    }
  }

  const createdRef = await collectionRef.add({
    ...payload,
    createdAt: new Date().toISOString(),
  })

  return {
    uid: context.uid,
    collection,
    docId: createdRef.id,
    created: true,
  }
}

async function firebaseCreateTask(
  input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  const data = (input.data && typeof input.data === "object" ? input.data : {}) as Record<string, unknown>
  return firebaseCreateUserRecord(
    {
      collection: "tasks",
      docId: input.docId,
      data: {
        title: String(data.title ?? "Untitled task"),
        description: String(data.description ?? ""),
        status: String(data.status ?? "pending"),
        priority: String(data.priority ?? "medium"),
        ...data,
      },
    },
    context,
  )
}

async function firebaseCreateTransaction(
  input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  const data = (input.data && typeof input.data === "object" ? input.data : {}) as Record<string, unknown>
  return firebaseCreateUserRecord(
    {
      collection: "transactions",
      docId: input.docId,
      data: {
        amount: Number(data.amount ?? 0),
        type: String(data.type ?? "expense"),
        category: String(data.category ?? "general"),
        merchant: String(data.merchant ?? "Unknown"),
        status: String(data.status ?? "completed"),
        ...data,
      },
    },
    context,
  )
}

async function firebaseCreateInvoice(
  input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  const data = (input.data && typeof input.data === "object" ? input.data : {}) as Record<string, unknown>
  return firebaseCreateUserRecord(
    {
      collection: "invoices",
      docId: input.docId,
      data: {
        title: String(data.title ?? "Invoice"),
        amount: Number(data.amount ?? 0),
        status: String(data.status ?? "draft"),
        customer: String(data.customer ?? ""),
        dueDate: String(data.dueDate ?? ""),
        ...data,
      },
    },
    context,
  )
}

async function firebaseCreateReimbursement(
  input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  const data = (input.data && typeof input.data === "object" ? input.data : {}) as Record<string, unknown>
  return firebaseCreateUserRecord(
    {
      collection: "reimbursements",
      docId: input.docId,
      data: {
        title: String(data.title ?? "Reimbursement"),
        amount: Number(data.amount ?? 0),
        status: String(data.status ?? "submitted"),
        category: String(data.category ?? "general"),
        notes: String(data.notes ?? ""),
        ...data,
      },
    },
    context,
  )
}

async function firebaseDeleteForUser(
  input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  if (!context.uid) {
    throw new Error("Sign in is required to delete user Firebase data")
  }

  const pathInput = String(input.path ?? "").trim()
  if (!pathInput) {
    throw new Error("path is required")
  }

  const scopedPath = resolveUserScopedPath(pathInput, context.uid)
  const segments = scopedPath.split("/")
  if (segments.length % 2 !== 0) {
    throw new Error("path must target a document (collection/doc)")
  }

  const db = getFirebaseAdminDb()
  await db.doc(scopedPath).delete()

  return {
    uid: context.uid,
    path: scopedPath,
    deleted: true,
  }
}

async function firebaseQueryUserCollection(
  input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  if (!context.uid) {
    throw new Error("Sign in is required to query user Firebase data")
  }

  const collectionPath = String(input.collection ?? "transactions").trim()
  const scopedPath = resolveUserScopedPath(collectionPath, context.uid)
  const segments = scopedPath.split("/")
  if (segments.length % 2 === 0) {
    throw new Error("collection must target a collection path")
  }

  const limit = Math.max(1, Math.min(200, Number(input.limit ?? 50)))
  const orderByField = String(input.orderBy ?? "createdAt").trim() || "createdAt"
  const orderDirection = String(input.direction ?? "desc").toLowerCase() === "asc" ? "asc" : "desc"

  const whereField = String(input.whereField ?? "").trim()
  const whereOpRaw = String(input.whereOp ?? "").trim()
  const whereValue = input.whereValue

  const allowedWhereOps = new Set([
    "==",
    "!=",
    ">",
    ">=",
    "<",
    "<=",
    "array-contains",
    "in",
    "array-contains-any",
    "not-in",
  ])

  const db = getFirebaseAdminDb()
  let queryRef: Query<DocumentData> = db.collection(scopedPath)

  if (whereField && whereOpRaw && whereValue !== undefined) {
    if (!allowedWhereOps.has(whereOpRaw)) {
      throw new Error(`Unsupported whereOp: ${whereOpRaw}`)
    }
    queryRef = queryRef.where(
      whereField,
      whereOpRaw as WhereFilterOp,
      whereValue,
    )
  }

  queryRef = queryRef.orderBy(orderByField, orderDirection).limit(limit)
  const snapshots = await queryRef.get()

  return {
    uid: context.uid,
    path: scopedPath,
    count: snapshots.size,
    docs: snapshots.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })),
  }
}

async function firebaseAggregateUserCollection(
  input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  if (!context.uid) {
    throw new Error("Sign in is required to aggregate user Firebase data")
  }

  const collectionPath = String(input.collection ?? "transactions").trim()
  const scopedPath = resolveUserScopedPath(collectionPath, context.uid)
  const segments = scopedPath.split("/")
  if (segments.length % 2 === 0) {
    throw new Error("collection must target a collection path")
  }

  const numericField = String(input.numericField ?? "amount").trim() || "amount"
  const groupBy = String(input.groupBy ?? "").trim()
  const limit = Math.max(1, Math.min(1000, Number(input.limit ?? 500)))

  const db = getFirebaseAdminDb()
  const snapshots = await db.collection(scopedPath).limit(limit).get()

  let count = 0
  let sum = 0
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  const groups: Record<string, { count: number; sum: number }> = {}

  for (const docSnap of snapshots.docs) {
    const data = docSnap.data() as Record<string, unknown>
    const value = Number(data[numericField] ?? 0)
    if (!Number.isFinite(value)) {
      continue
    }

    count += 1
    sum += value
    min = Math.min(min, value)
    max = Math.max(max, value)

    if (groupBy) {
      const key = String(data[groupBy] ?? "Unknown")
      const current = groups[key] ?? { count: 0, sum: 0 }
      groups[key] = { count: current.count + 1, sum: current.sum + value }
    }
  }

  return {
    uid: context.uid,
    path: scopedPath,
    numericField,
    count,
    sum,
    average: count > 0 ? sum / count : 0,
    min: count > 0 ? min : null,
    max: count > 0 ? max : null,
    groups: groupBy ? groups : null,
  }
}

async function firebaseBulkCreateUserRecords(
  input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  if (!context.uid) {
    throw new Error("Sign in is required to bulk-create user Firebase records")
  }

  const collectionPath = String(input.collection ?? "").trim()
  if (!collectionPath) {
    throw new Error("collection is required")
  }

  const records = Array.isArray(input.records) ? input.records : []
  if (records.length === 0) {
    throw new Error("records array is required")
  }

  const capped = records.slice(0, 100)
  const scopedPath = resolveUserScopedPath(collectionPath, context.uid)
  const segments = scopedPath.split("/")
  if (segments.length % 2 === 0) {
    throw new Error("collection must target a collection path")
  }

  const db = getFirebaseAdminDb()
  const collectionRef = db.collection(scopedPath)
  const batch = db.batch()

  const createdIds: string[] = []

  for (const entry of capped) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue
    }

    const payload = entry as Record<string, unknown>
    const providedId = typeof payload.docId === "string" ? payload.docId.trim() : ""
    const docRef = providedId ? collectionRef.doc(providedId) : collectionRef.doc()
    const { docId: _ignoreDocId, ...data } = payload

    batch.set(
      docRef,
      {
        ...data,
        createdAt: data.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )

    createdIds.push(docRef.id)
  }

  await batch.commit()

  return {
    uid: context.uid,
    path: scopedPath,
    createdCount: createdIds.length,
    docIds: createdIds,
    truncated: records.length > capped.length,
  }
}

async function firebaseDeleteUserRecordsByMatch(
  input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  if (!context.uid) {
    throw new Error("Sign in is required to delete user Firebase records")
  }

  const collectionPath = String(input.collection ?? "").trim()
  if (!collectionPath) {
    throw new Error("collection is required")
  }

  const field = String(input.field ?? "title").trim() || "title"
  const value = String(input.value ?? "").trim()
  if (!value) {
    throw new Error("value is required")
  }

  const maxDelete = Math.max(1, Math.min(50, Number(input.limit ?? 20)))
  const caseInsensitive = Boolean(input.caseInsensitive ?? true)

  const scopedPath = resolveUserScopedPath(collectionPath, context.uid)
  const segments = scopedPath.split("/")
  if (segments.length % 2 === 0) {
    throw new Error("collection must target a collection path")
  }

  const db = getFirebaseAdminDb()
  const snapshots = await db.collection(scopedPath).limit(200).get()
  const expected = caseInsensitive ? value.toLowerCase() : value

  const matched = snapshots.docs.filter((docSnap: QueryDocumentSnapshot<DocumentData>) => {
    const data = docSnap.data() as Record<string, unknown>
    const current = String(data[field] ?? "").trim()
    if (!current) {
      return false
    }
    return caseInsensitive ? current.toLowerCase() === expected : current === expected
  })

  const toDelete = matched.slice(0, maxDelete)
  if (toDelete.length === 0) {
    return {
      uid: context.uid,
      path: scopedPath,
      field,
      value,
      deletedCount: 0,
      docIds: [],
      message: "No matching records found",
    }
  }

  const batch = db.batch()
  for (const docSnap of toDelete) {
    batch.delete(docSnap.ref)
  }
  await batch.commit()

  return {
    uid: context.uid,
    path: scopedPath,
    field,
    value,
    deletedCount: toDelete.length,
    docIds: toDelete.map((docSnap: QueryDocumentSnapshot<DocumentData>) => docSnap.id),
    truncated: matched.length > toDelete.length,
  }
}

async function firebaseExportUserCollection(
  input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  if (!context.uid) {
    throw new Error("Sign in is required to export user Firebase data")
  }

  const collectionPath = String(input.collection ?? "transactions").trim()
  const format = String(input.format ?? "json").toLowerCase()
  const allowedFormats = new Set(["json", "jsonl", "csv", "markdown"])
  if (!allowedFormats.has(format)) {
    throw new Error("format must be one of: json, jsonl, csv, markdown")
  }

  const scopedPath = resolveUserScopedPath(collectionPath, context.uid)
  const segments = scopedPath.split("/")
  if (segments.length % 2 === 0) {
    throw new Error("collection must target a collection path")
  }

  const limit = Math.max(1, Math.min(1000, Number(input.limit ?? 200)))
  const orderByField = String(input.orderBy ?? "createdAt").trim() || "createdAt"
  const orderDirection = String(input.direction ?? "desc").toLowerCase() === "asc" ? "asc" : "desc"
  const fieldInput = Array.isArray(input.fields) ? input.fields : []
  const explicitFields = fieldInput
    .map((field) => String(field ?? "").trim())
    .filter(Boolean)

  const db = getFirebaseAdminDb()
  const snapshots = await db
    .collection(scopedPath)
    .orderBy(orderByField, orderDirection)
    .limit(limit)
    .get()

  const docs: Array<Record<string, unknown>> = snapshots.docs.map(
    (docSnap: QueryDocumentSnapshot<DocumentData>) => ({
    id: docSnap.id,
    ...docSnap.data(),
    }),
  )

  const fields =
    explicitFields.length > 0
      ? explicitFields
      : Array.from(new Set(docs.flatMap((row: Record<string, unknown>) => Object.keys(row))))

  const pickRow = (row: Record<string, unknown>) => {
    if (fields.length === 0) {
      return row
    }

    const next: Record<string, unknown> = {}
    for (const field of fields) {
      next[field] = row[field]
    }
    return next
  }

  const normalizedRows = docs.map((row: Record<string, unknown>) => pickRow(row))

  const toCell = (value: unknown) => {
    if (value === null || value === undefined) {
      return ""
    }
    const text = typeof value === "object" ? JSON.stringify(value) : String(value)
    return text.replace(/"/g, '""')
  }

  let content = ""

  if (format === "json") {
    content = JSON.stringify(normalizedRows, null, 2)
  } else if (format === "jsonl") {
    content = normalizedRows.map((row: Record<string, unknown>) => JSON.stringify(row)).join("\n")
  } else if (format === "csv") {
    const headers = fields.length > 0 ? fields : ["id"]
    const headerLine = headers.map((header) => `"${toCell(header)}"`).join(",")
    const lines = normalizedRows.map((row: Record<string, unknown>) =>
      headers
        .map((header) => `"${toCell((row as Record<string, unknown>)[header])}"`)
        .join(","),
    )
    content = [headerLine, ...lines].join("\n")
  } else {
    const headers = fields.length > 0 ? fields : ["id"]
    const header = `| ${headers.join(" | ")} |`
    const divider = `| ${headers.map(() => "---").join(" | ")} |`
    const rows = normalizedRows.map((row: Record<string, unknown>) => {
      const cells = headers.map((headerKey) => {
        const raw = (row as Record<string, unknown>)[headerKey]
        const rendered = typeof raw === "object" ? JSON.stringify(raw) : String(raw ?? "")
        return rendered.replace(/\|/g, "\\|")
      })
      return `| ${cells.join(" | ")} |`
    })
    content = [header, divider, ...rows].join("\n")
  }

  return {
    uid: context.uid,
    path: scopedPath,
    format,
    count: normalizedRows.length,
    fields,
    content,
  }
}

async function firebaseUserTransactionsStats(
  input: Record<string, unknown> = {},
  context: AgentUserContext,
) {
  if (!context.uid) {
    throw new Error("Sign in is required to calculate user transaction stats")
  }

  const limit = Math.max(1, Math.min(500, Number(input.limit ?? 200)))
  const db = getFirebaseAdminDb()
  const snap = await db
    .collection("users")
    .doc(context.uid)
    .collection("transactions")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get()

  let totalIncome = 0
  let totalExpense = 0
  const byCategory: Record<string, number> = {}

  const items = snap.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => {
    const data = docSnap.data() as Record<string, unknown>
    const amount = Number(data.amount ?? 0)
    const type = String(data.type ?? "")
    const category = String(data.category ?? "Uncategorized")
    const merchant = String(data.merchant ?? "Unknown")
    const status = String(data.status ?? "completed")

    if (type === "income") {
      totalIncome += amount
    } else {
      totalExpense += amount
    }

    byCategory[category] = (byCategory[category] ?? 0) + amount

    return {
      id: docSnap.id,
      amount,
      type,
      category,
      merchant,
      status,
    }
  })

  return {
    uid: context.uid,
    count: items.length,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    byCategory,
    transactions: items,
  }
}

const TOOL_DESCRIPTIONS = [
  "read_project_file: Read a file from workspace. Input: { filePath, startLine?, endLine? }",
  "edit_project_file: Edit workspace file by replacing a text block. Input: { filePath, findText, replaceText }",
  "run_action_cmd: Run analysis commands over text/file. Input: { command: word_count|line_count|sum_numbers|extract_emails, text?, filePath? }",
  "firebase_list_user_data: List signed-in user's root data and available collections.",
  "firebase_read: Read signed-in user Firebase data from users/{uid}/... Input: { path?: <blank for user doc>|transactions|tasks|notifications|<collection>/<doc>, limit? }",
  "firebase_write: Write signed-in user Firebase document under users/{uid}/... Input: { path, data, merge? }",
  "firebase_create_record: Create/update user record in any collection. Input: { collection, data, docId? }",
  "firebase_create_task: Create/update user task. Input: { data, docId? }",
  "firebase_create_transaction: Create/update user transaction. Input: { data, docId? }",
  "firebase_create_invoice: Create/update user invoice. Input: { data, docId? }",
  "firebase_create_reimbursement: Create/update user reimbursement. Input: { data, docId? }",
  "firebase_delete: Delete a signed-in user document under users/{uid}/... Input: { path }",
  "firebase_query_collection: Query signed-in user's collection with optional where/order/limit. Input: { collection, whereField?, whereOp?, whereValue?, orderBy?, direction?, limit? }",
  "firebase_aggregate_collection: Aggregate numeric values for signed-in user's collection. Input: { collection, numericField?, groupBy?, limit? }",
  "firebase_bulk_create_records: Bulk create/update signed-in user's records. Input: { collection, records:[{... , docId?}], limit<=100 }",
  "firebase_delete_records_by_match: Delete signed-in user's records by field match. Input: { collection, field?, value, caseInsensitive?, limit? }",
  "firebase_export_collection: Export signed-in user's collection in specified format. Input: { collection, format: json|jsonl|csv|markdown, fields?, orderBy?, direction?, limit? }",
  "firebase_user_transactions_stats: Compute totals and breakdown from signed-in user's transactions. Input: { limit? }",
]

function extractJsonBlock(text: string): string | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1)
  }

  return null
}

function parseLenientJsonObject(input: string): unknown {
  try {
    return JSON.parse(input)
  } catch {
    // Handle common LLM JSON issues: unquoted keys, single quotes and trailing commas.
    const normalized = input
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
      .replace(/,\s*([}\]])/g, "$1")

    return JSON.parse(normalized)
  }
}

function coerceToolInput(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>
  }

  return {}
}

function parseAgentStep(modelText: string): AgentStep | null {
  const jsonBlock = extractJsonBlock(modelText)
  if (!jsonBlock) {
    return null
  }

  try {
    const parsed = parseLenientJsonObject(jsonBlock) as Partial<AgentStep>
    if (parsed.action === "final" && typeof parsed.response === "string") {
      return { action: "final", response: parsed.response }
    }

    if (
      parsed.action === "tool" &&
      parsed.tool &&
      typeof (parsed.tool as ToolCall).name === "string"
    ) {
      return {
        action: "tool",
        tool: {
          name: (parsed.tool as ToolCall).name,
          input: coerceToolInput((parsed.tool as ToolCall).input),
        },
      }
    }

    return null
  } catch {
    return null
  }
}

function parseLegacyAgentStep(modelText: string): AgentStep | null {
  const jsonBlock = extractJsonBlock(modelText)
  if (!jsonBlock) {
    return null
  }

  try {
    const parsed = parseLenientJsonObject(jsonBlock) as Record<string, unknown>

    // Legacy/faulty shape seen from some models:
    // {"action":"read_project_file","input":{...}}
    // {"action":"read_project_file","tool":{...}}
    // {"tool":"read_project_file","input":{...}}
    const action = typeof parsed.action === "string" ? parsed.action : ""
    const toolField = parsed.tool

    if (action && action !== "tool" && action !== "final") {
      const toolName = action
      let input: Record<string, unknown> = {}

      if (toolField && typeof toolField === "object" && !Array.isArray(toolField)) {
        const nested = toolField as Record<string, unknown>
        if (nested.input && typeof nested.input === "object" && !Array.isArray(nested.input)) {
          input = nested.input as Record<string, unknown>
        } else if (parsed.input && typeof parsed.input === "object" && !Array.isArray(parsed.input)) {
          input = parsed.input as Record<string, unknown>
        }
      } else if (parsed.input && typeof parsed.input === "object" && !Array.isArray(parsed.input)) {
        input = parsed.input as Record<string, unknown>
      }

      return {
        action: "tool",
        tool: {
          name: toolName,
          input,
        },
      }
    }

    if (typeof toolField === "string") {
      return {
        action: "tool",
        tool: {
          name: toolField,
          input:
            parsed.input && typeof parsed.input === "object" && !Array.isArray(parsed.input)
              ? (parsed.input as Record<string, unknown>)
              : {},
        },
      }
    }

    return null
  } catch {
    return null
  }
}

function shouldPrefetchUserTransactionStats(message: string): boolean {
  return /(calculate|calculation|sum|total|anomal|expense|income|balance|spend|net|budget)/i.test(
    message,
  )
}

function inferUserCollectionPathFromMessage(message: string): string | null {
  const lower = message.toLowerCase()

  if (/(task|todo|checklist)/.test(lower)) {
    return "tasks"
  }

  if (/(notification|alert)/.test(lower)) {
    return "notifications"
  }

  if (/(profile|account|user\s+info)/.test(lower)) {
    return ""
  }

  if (/(payment)/.test(lower)) {
    return "payments"
  }

  if (/(reimbursement|reimburse)/.test(lower)) {
    return "reimbursements"
  }

  return null
}

function inferCreateIntentFromMessage(
  message: string,
):
  | { tool: "firebase_create_task"; input: Record<string, unknown> }
  | { tool: "firebase_create_transaction"; input: Record<string, unknown> }
  | { tool: "firebase_create_invoice"; input: Record<string, unknown> }
  | { tool: "firebase_create_reimbursement"; input: Record<string, unknown> }
  | null {
  const lower = message.toLowerCase()

  const getAmount = () => {
    const match = message.match(/(?:amount|rs|inr|\$)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i)
    return match?.[1] ? Number(match[1]) : 0
  }

  if (/(create|add|new|write).*(task)|task.*(create|add|new|write)/i.test(lower)) {
    const titleMatch = message.match(/(?:title|task)\s*[:=]\s*([^,\n]+)/i)
    const descriptionMatch = message.match(/(?:description|details?)\s*[:=]\s*([^\n]+)/i)
    return {
      tool: "firebase_create_task",
      input: {
        data: {
          title: titleMatch?.[1]?.trim() || message.trim(),
          description: descriptionMatch?.[1]?.trim() || "",
          status: /done|completed/i.test(lower) ? "completed" : "pending",
          priority: /high/i.test(lower) ? "high" : /low/i.test(lower) ? "low" : "medium",
        },
      },
    }
  }

  if (/(create|add|new|write).*(transaction|transact|tranacr|tranac)|(transaction|transact|tranacr|tranac).*(create|add|new|write)/i.test(lower)) {
    const categoryMatch = message.match(/(?:category)\s*[:=]\s*([^,\n]+)/i)
    const merchantMatch = message.match(/(?:merchant)\s*[:=]\s*([^,\n]+)/i)
    return {
      tool: "firebase_create_transaction",
      input: {
        data: {
          amount: getAmount(),
          type: /income/i.test(lower) ? "income" : "expense",
          category: categoryMatch?.[1]?.trim() || "general",
          merchant: merchantMatch?.[1]?.trim() || "Unknown",
          status: "completed",
        },
      },
    }
  }

  if (/(create|add|new|write).*(invoice)|invoice.*(create|add|new|write)/i.test(lower)) {
    const customerMatch = message.match(/(?:customer|client)\s*[:=]\s*([^,\n]+)/i)
    const titleMatch = message.match(/(?:title|invoice)\s*[:=]\s*([^,\n]+)/i)
    const dueDateMatch = message.match(/(?:due|dueDate)\s*[:=]\s*([^,\n]+)/i)
    return {
      tool: "firebase_create_invoice",
      input: {
        data: {
          title: titleMatch?.[1]?.trim() || "Invoice",
          amount: getAmount(),
          status: /paid/i.test(lower) ? "paid" : "draft",
          customer: customerMatch?.[1]?.trim() || "",
          dueDate: dueDateMatch?.[1]?.trim() || "",
        },
      },
    }
  }

  if (/(create|add|new|write).*(reimbursement|reimburse)|(reimbursement|reimburse).*(create|add|new|write)/i.test(lower)) {
    const titleMatch = message.match(/(?:title|reimbursement)\s*[:=]\s*([^,\n]+)/i)
    const categoryMatch = message.match(/(?:category)\s*[:=]\s*([^,\n]+)/i)
    const notesMatch = message.match(/(?:note|notes|description)\s*[:=]\s*([^\n]+)/i)
    const amountMatch = message.match(/(?:amount|rs|inr|\$)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i)
    return {
      tool: "firebase_create_reimbursement",
      input: {
        data: {
          title: titleMatch?.[1]?.trim() || "Reimbursement",
          amount: amountMatch?.[1] ? Number(amountMatch[1]) : 0,
          status: /approved/i.test(lower) ? "approved" : /rejected/i.test(lower) ? "rejected" : "submitted",
          category: categoryMatch?.[1]?.trim() || "general",
          notes: notesMatch?.[1]?.trim() || "",
        },
      },
    }
  }

  return null
}

function inferDeleteIntentFromMessage(
  message: string,
):
  | { tool: "firebase_delete_records_by_match"; input: Record<string, unknown> }
  | null {
  const lower = message.toLowerCase()
  if (!/(delete|remove|erase)\b/.test(lower)) {
    return null
  }

  const namedMatch = message.match(/(?:named|title|called|name)\s*[:=]?\s*["']?([^"'\n,]+)["']?/i)
  const quotedMatch = message.match(/["']([^"']+)["']/)
  const value = (namedMatch?.[1] || quotedMatch?.[1] || "").trim()

  if (!value) {
    return null
  }

  let collection = "tasks"
  let field = "title"

  if (/(transaction|payment|expense|income)/.test(lower)) {
    collection = "transactions"
    field = /merchant/.test(lower) ? "merchant" : "category"
  } else if (/(invoice)/.test(lower)) {
    collection = "invoices"
    field = /customer|client/.test(lower) ? "customer" : "title"
  } else if (/(reimbursement|reimburse)/.test(lower)) {
    collection = "reimbursements"
    field = "title"
  }

  return {
    tool: "firebase_delete_records_by_match",
    input: {
      collection,
      field,
      value,
      caseInsensitive: true,
      limit: 20,
    },
  }
}

function inferExportIntentFromMessage(
  message: string,
):
  | { tool: "firebase_export_collection"; input: Record<string, unknown> }
  | null {
  const lower = message.toLowerCase()
  // Check if this looks like an export request
  if (!/\b(export|extract|download|save|get|show|dump|send)\b.*\b(as|to|in|format)\b|\bformat\b.*(csv|json|markdown|jsonl)/i.test(lower)) {
    return null
  }

  // Detect format from natural language
  let format = "json" // default
  if (/\bcsv\b|comma.?separated/i.test(lower)) {
    format = "csv"
  } else if (/\bjsonl\b|newline.?delimited|ndjson/i.test(lower)) {
    format = "jsonl"
  } else if (/\bmarkdown\b|\btable\b/i.test(lower)) {
    format = "markdown"
  } else if (/json/i.test(lower)) {
    format = "json"
  }

  // Detect collection from context
  let collection = "transactions" // default
  if (/(task|todo)/i.test(lower)) {
    collection = "tasks"
  } else if (/(invoice)/i.test(lower)) {
    collection = "invoices"
  } else if (/(reimbursement|reimburse)/i.test(lower)) {
    collection = "reimbursements"
  } else if (/(transaction|payment|expense|income)/i.test(lower)) {
    collection = "transactions"
  } else if (/(notification|notify)/i.test(lower)) {
    collection = "notifications"
  }

  // Extract optional fields
  const fieldsMatch = message.match(/(?:field|column|attribute|select)s?\s*[:=]?\s*([^,\n]+)/i)
  const fields = fieldsMatch
    ? fieldsMatch[1]
        .split(/[,;]|\s+and\s+/i)
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined

  // Extract optional limit
  const limitMatch = message.match(/(?:limit|max|first|top)\s*[:=]?\s*(\d+)/i)
  const limit = limitMatch ? Number(limitMatch[1]) : 200

  // Extract ordering preference
  const orderByMatch = message.match(/(?:order|sort|group)\s*(?:by)?\s*([a-z]+)/i)
  const orderBy = orderByMatch?.[1] || undefined
  const orderDir = /\b(desc|descending|reverse)\b/i.test(lower) ? "desc" : "asc"

  return {
    tool: "firebase_export_collection",
    input: {
      collection,
      format,
      ...(fields && { fields }),
      limit,
      ...(orderBy && { orderBy }),
      ...(orderBy && { direction: orderDir }),
    },
  }
}

function toMarkdownTable(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const output = value as Record<string, unknown>
  const docs = Array.isArray(output.docs)
    ? (output.docs as Array<Record<string, unknown>>)
    : Array.isArray(output.transactions)
      ? (output.transactions as Array<Record<string, unknown>>)
      : null

  if (!docs || docs.length === 0) {
    return null
  }

  const columns = Array.from(
    new Set(docs.flatMap((row: Record<string, unknown>) => Object.keys(row || {}))),
  ).slice(0, 8)

  if (columns.length === 0) {
    return null
  }

  const header = `| ${columns.join(" | ")} |`
  const divider = `| ${columns.map(() => "---").join(" | ")} |`
  const rows = docs.slice(0, 20).map((row: Record<string, unknown>) => {
    const cells = columns.map((column) => {
      const raw = (row as Record<string, unknown>)[column]
      const rendered = typeof raw === "object" ? JSON.stringify(raw) : String(raw ?? "")
      return rendered.replace(/\|/g, "\\|")
    })
    return `| ${cells.join(" | ")} |`
  })

  return [header, divider, ...rows].join("\n")
}

function buildToolSummaryMarkdown(
  toolMemory: Array<{ tool: string; input: Record<string, unknown>; output: unknown }>,
): string | null {
  if (toolMemory.length === 0) {
    return null
  }

  const latest = toolMemory[toolMemory.length - 1]
  const table = toMarkdownTable(latest?.output)
  if (!table) {
    return null
  }

  return `\n\nData table (${latest.tool}):\n\n${table}`
}

function getTextFromGenerateResponse(response: any): string {
  if (typeof response?.text === "string") {
    return response.text
  }

  if (typeof response?.output?.text === "string") {
    return response.output.text
  }

  if (typeof response?.message?.text === "string") {
    return response.message.text
  }

  return ""
}

const TOOL_HANDLERS: Record<
  string,
  (input: Record<string, unknown>, context: AgentUserContext) => Promise<unknown>
> = {
  read_project_file: readProjectFile,
  edit_project_file: editProjectFile,
  run_action_cmd: runActionCommand,
  firebase_list_user_data: firebaseListUserData,
  firebase_read: firebaseReadForUser,
  firebase_write: firebaseWriteForUser,
  firebase_create_record: firebaseCreateUserRecord,
  firebase_create_task: firebaseCreateTask,
  firebase_create_transaction: firebaseCreateTransaction,
  firebase_create_invoice: firebaseCreateInvoice,
  firebase_create_reimbursement: firebaseCreateReimbursement,
  firebase_delete: firebaseDeleteForUser,
  firebase_query_collection: firebaseQueryUserCollection,
  firebase_aggregate_collection: firebaseAggregateUserCollection,
  firebase_bulk_create_records: firebaseBulkCreateUserRecords,
  firebase_delete_records_by_match: firebaseDeleteUserRecordsByMatch,
  firebase_export_collection: firebaseExportUserCollection,
  firebase_user_transactions_stats: firebaseUserTransactionsStats,
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AgentRequest
  const userContext = await resolveUserContext(request)
  const mode: AgentMode = body.mode === "chat" ? "chat" : "agent"
  const selectedModel = resolveRequestedModel(body.model)
  const message = String(body.message ?? "").trim()
  const history = Array.isArray(body.history) ? body.history : []
  const iterationLimit = getIterationLimit(mode)

  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 })
  }

  return createStreamResponse(async (emit) => {
    const toolMemory: Array<{ tool: string; input: Record<string, unknown>; output: unknown }> = []

    const inferredCreateIntent = inferCreateIntentFromMessage(message)
    const inferredDeleteIntent = inferDeleteIntentFromMessage(message)
    const inferredExportIntent = inferExportIntentFromMessage(message)
    if (userContext.uid && inferredCreateIntent) {
      emit({ type: "state", state: "working" })
      emit({
        type: "tool",
        tool: inferredCreateIntent.tool,
        input: inferredCreateIntent.input,
      })

      try {
        const createHandler = TOOL_HANDLERS[inferredCreateIntent.tool]
        const created = await createHandler(inferredCreateIntent.input, userContext)
        toolMemory.push({
          tool: inferredCreateIntent.tool,
          input: inferredCreateIntent.input,
          output: created,
        })
        emit({ type: "tool_result", tool: inferredCreateIntent.tool, output: created })
      } catch (error) {
        const output = {
          error: error instanceof Error ? error.message : "Failed to create user record",
        }
        toolMemory.push({
          tool: inferredCreateIntent.tool,
          input: inferredCreateIntent.input,
          output,
        })
        emit({ type: "tool_result", tool: inferredCreateIntent.tool, output })
      }
    }

    if (userContext.uid && inferredDeleteIntent) {
      emit({ type: "state", state: "working" })
      emit({
        type: "tool",
        tool: inferredDeleteIntent.tool,
        input: inferredDeleteIntent.input,
      })

      try {
        const deleteHandler = TOOL_HANDLERS[inferredDeleteIntent.tool]
        const deleted = await deleteHandler(inferredDeleteIntent.input, userContext)
        toolMemory.push({
          tool: inferredDeleteIntent.tool,
          input: inferredDeleteIntent.input,
          output: deleted,
        })
        emit({ type: "tool_result", tool: inferredDeleteIntent.tool, output: deleted })
      } catch (error) {
        const output = {
          error: error instanceof Error ? error.message : "Failed to delete user record",
        }
        toolMemory.push({
          tool: inferredDeleteIntent.tool,
          input: inferredDeleteIntent.input,
          output,
        })
        emit({ type: "tool_result", tool: inferredDeleteIntent.tool, output })
      }
    }

    if (userContext.uid && inferredExportIntent) {
      emit({ type: "state", state: "working" })
      emit({
        type: "tool",
        tool: inferredExportIntent.tool,
        input: inferredExportIntent.input,
      })

      try {
        const exportHandler = TOOL_HANDLERS[inferredExportIntent.tool]
        const exported = await exportHandler(inferredExportIntent.input, userContext)
        toolMemory.push({
          tool: inferredExportIntent.tool,
          input: inferredExportIntent.input,
          output: exported,
        })
        emit({ type: "tool_result", tool: inferredExportIntent.tool, output: exported })
      } catch (error) {
        const output = {
          error: error instanceof Error ? error.message : "Failed to export collection",
        }
        toolMemory.push({
          tool: inferredExportIntent.tool,
          input: inferredExportIntent.input,
          output,
        })
        emit({ type: "tool_result", tool: inferredExportIntent.tool, output })
      }
    }

    const inferredCollectionPath = inferUserCollectionPathFromMessage(message)

    if (userContext.uid && inferredCollectionPath !== null) {
      emit({ type: "state", state: "working" })
      emit({
        type: "tool",
        tool: "firebase_read",
        input: inferredCollectionPath ? { path: inferredCollectionPath, limit: 50 } : { path: "" },
      })

      try {
        const preloaded = await firebaseReadForUser(
          inferredCollectionPath ? { path: inferredCollectionPath, limit: 50 } : { path: "" },
          userContext,
        )
        toolMemory.push({
          tool: "firebase_read",
          input: inferredCollectionPath ? { path: inferredCollectionPath, limit: 50 } : { path: "" },
          output: preloaded,
        })
        emit({ type: "tool_result", tool: "firebase_read", output: preloaded })
      } catch (error) {
        const output = {
          error: error instanceof Error ? error.message : "Failed to preload requested collection",
        }
        toolMemory.push({
          tool: "firebase_read",
          input: inferredCollectionPath ? { path: inferredCollectionPath, limit: 50 } : { path: "" },
          output,
        })
        emit({ type: "tool_result", tool: "firebase_read", output })
      }
    }

    if (userContext.uid && shouldPrefetchUserTransactionStats(message)) {
      emit({ type: "state", state: "working" })
      emit({ type: "tool", tool: "firebase_user_transactions_stats", input: { limit: 200 } })

      try {
        const preloaded = await firebaseUserTransactionsStats({ limit: 200 }, userContext)
        toolMemory.push({
          tool: "firebase_user_transactions_stats",
          input: { limit: 200 },
          output: preloaded,
        })
        emit({ type: "tool_result", tool: "firebase_user_transactions_stats", output: preloaded })
      } catch (error) {
        const output = {
          error: error instanceof Error ? error.message : "Failed to preload user transaction stats",
        }
        toolMemory.push({
          tool: "firebase_user_transactions_stats",
          input: { limit: 200 },
          output,
        })
        emit({ type: "tool_result", tool: "firebase_user_transactions_stats", output })
      }
    }

    for (let iteration = 0; iteration < iterationLimit; iteration += 1) {
      emit({ type: "state", state: "thinking", iteration: iteration + 1 })

      const instructions = [
        "You are KIKO, an agentic AI assistant.",
        mode === "agent"
          ? "Operate in agent mode: pick tools when needed and iterate until task completion."
          : "Operate in chat mode: answer directly unless a tool is clearly needed.",
        userContext.uid
          ? `Authenticated user uid: ${userContext.uid}.`
          : "No authenticated user token is present.",
        "You must respond ONLY in strict JSON with one of two shapes:",
        '{"action":"tool","tool":{"name":"<tool_name>","input":{...}}}',
        '{"action":"final","response":"<final answer for user>"}',
        "Never set action to a tool name directly (invalid). Always use action=tool + tool.name.",
        "If user uploaded CSV/XLS/TXT data, it may already be embedded in USER text as 'Extracted attachment data'; use that data directly.",
        "Do not call read_project_file for Firebase-style paths like users/{uid}/... or uploaded attachment names.",
        "For requests about specific user data items (tasks, notifications, profile, etc.), call firebase_read with that path.",
        "For create/update requests (tasks, transactions, invoices, or other records), call firebase_create_task/firebase_create_transaction/firebase_create_invoice or firebase_create_record.",
        "For reimbursement creation/updates, call firebase_create_reimbursement.",
        "For filtered/sorted collection reads, call firebase_query_collection.",
        "For numeric summaries/grouping over a collection, call firebase_aggregate_collection.",
        "For deleting a specific user document, call firebase_delete.",
        "For natural delete requests like 'delete task named X', call firebase_delete_records_by_match.",
        "For creating many records at once from parsed attachment rows, call firebase_bulk_create_records.",
        "For exporting data, call firebase_export_collection and choose format json, jsonl, csv, or markdown.",
        "For requests about transaction calculations/totals, call firebase_user_transactions_stats.",
        "If user asks what data exists, call firebase_list_user_data first.",
        "Available tools:",
        ...TOOL_DESCRIPTIONS,
        "If enough information is available, use action=final.",
      ].join("\n")

      const conversation = [
        ...history.map((item) => `${item.role.toUpperCase()}: ${item.content}`),
        `USER: ${message}`,
      ].join("\n")

      const toolContext = toolMemory.length
        ? `\nTOOL_RESULTS:\n${JSON.stringify(toolMemory.slice(-4), null, 2)}`
        : ""

      const prompt = `${instructions}\n\nCONVERSATION:\n${conversation}${toolContext}`

      try {
        emit({ type: "tool", tool: `model:${selectedModel.provider}:${selectedModel.model}` })
        const { step, modelText } = await generateAgentStepWithSelectedModel(prompt, selectedModel)
        const normalizedStep = step ?? parseLegacyAgentStep(modelText)

        if (!normalizedStep) {
          toolMemory.push({
            tool: "model_parse_error",
            input: { iteration: iteration + 1 },
            output: {
              error: "Model did not return valid agent JSON",
              modelText: modelText.slice(0, 800),
            },
          })
          continue
        }

        if (normalizedStep.action === "final") {
          emit({ type: "state", state: "working" })
          const summaryTable = buildToolSummaryMarkdown(toolMemory)
          const finalText = `${normalizedStep.response}${summaryTable ?? ""}`

          if (selectedModel.provider === "ollama") {
            emit({ type: "tool", tool: `model_stream:${selectedModel.provider}:${selectedModel.model}` })

            const streamPrompt = [
              "You are KIKO. Return the final answer for the user in plain markdown.",
              "Do not output JSON.",
              "Prefer concise, actionable output.",
              `Draft answer:\n${finalText}`,
              `CONVERSATION:\n${conversation}`,
              toolContext ? `TOOL_CONTEXT:${toolContext}` : "",
            ]
              .filter(Boolean)
              .join("\n\n")

            try {
              const streamed = await streamFinalTextWithOllama(
                streamPrompt,
                selectedModel,
                (text) => {
                  emit({ type: "chunk", text })
                },
              )

              if (!streamed) {
                emit({ type: "chunk", text: finalText })
              }
              return
            } catch {
              emit({ type: "chunk", text: finalText })
              return
            }
          }

          const chunks = finalText.split(/\s+/).filter(Boolean)
          let current = ""
          for (const chunk of chunks) {
            current = `${current}${chunk} `
            emit({ type: "chunk", text: current.trimEnd() })
            await new Promise((resolve) => setTimeout(resolve, 12))
          }
          return
        }

        const handler = TOOL_HANDLERS[normalizedStep.tool.name]
        if (!handler) {
          toolMemory.push({
            tool: normalizedStep.tool.name,
            input: normalizedStep.tool.input ?? {},
            output: { error: "Unknown tool" },
          })
          continue
        }

        emit({ type: "state", state: "working" })
        emit({ type: "tool", tool: normalizedStep.tool.name, input: normalizedStep.tool.input ?? {} })

        try {
          const toolOutput = await handler(normalizedStep.tool.input ?? {}, userContext)
          toolMemory.push({
            tool: normalizedStep.tool.name,
            input: normalizedStep.tool.input ?? {},
            output: toolOutput,
          })
          emit({ type: "tool_result", tool: normalizedStep.tool.name, output: toolOutput })
        } catch (error) {
          const output = {
            error: error instanceof Error ? error.message : "Tool execution failed",
          }
          toolMemory.push({
            tool: normalizedStep.tool.name,
            input: normalizedStep.tool.input ?? {},
            output,
          })
          emit({ type: "tool_result", tool: normalizedStep.tool.name, output })
        }
      } catch (error) {
        emit({ type: "state", state: "working" })
        emit({ type: "chunk", text: formatModelError(error, selectedModel.provider) })
        return
      }
    }

    const lastOutput = toolMemory[toolMemory.length - 1]?.output
    if (lastOutput) {
      emit({
        type: "chunk",
        text: `Completed with latest tool result:\n\n${JSON.stringify(lastOutput, null, 2)}`,
      })
      return
    }

    emit({
      type: "chunk",
      text: "I reached the max iteration limit for this run. Ask me to continue if you want more steps.",
    })
  })
}
