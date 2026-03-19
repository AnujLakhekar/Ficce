import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bot, ChartNoAxesCombined, ShieldCheck, Wallet } from "lucide-react";

const features = [
  {
    title: "Smart Transaction Tracking",
    description:
      "Track income and expenses in one place with organized categories and clear history.",
    icon: Wallet,
  },
  {
    title: "AI Financial Insights",
    description:
      "Get practical suggestions to improve cash flow, spending habits, and monthly planning.",
    icon: Bot,
  },
  {
    title: "Live Performance Overview",
    description:
      "Monitor your revenue trends and key metrics through clean, actionable dashboards.",
    icon: ChartNoAxesCombined,
  },
  {
    title: "Secure by Default",
    description:
      "Your account data stays protected with modern authentication and trusted infrastructure.",
    icon: ShieldCheck,
  },
];

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-text">
      <section className="mx-auto max-w-7xl px-6 py-10 md:px-10 md:py-14">
        <div className="rounded-3xl border border-outline bg-forground p-6 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center rounded-full border border-outline bg-secondary px-4 py-1.5 text-xs font-semibold tracking-wide text-text-secondary">
                AI-Powered Finance For Freelancers
              </span>

              <h1 className="mt-5 text-4xl font-semibold leading-tight md:text-6xl md:leading-[1.1]">
                Control Your Finances Without Spreadsheets
              </h1>

              <p className="mt-4 max-w-xl text-base text-text-secondary md:text-lg">
                ficce helps you manage transactions, monitor cash flow, and stay on top of your
                business health with a fast and focused workflow.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  className="inline-flex items-center gap-2 rounded-xl bg-text px-5 py-3 text-sm font-semibold text-forground transition hover:opacity-90"
                  href="/auth"
                >
                  Get Started
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  className="inline-flex items-center rounded-xl border border-outline bg-forground px-5 py-3 text-sm font-semibold text-text transition hover:bg-secondary"
                  href="/dashboard"
                >
                  Open Dashboard
                </Link>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-outline">
              <Image
                alt="Gradient finance preview"
                className="h-[320px] w-full object-cover md:h-[420px]"
                height={840}
                priority
                src="/sidebg.jpg"
                width={1120}
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/20 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12 md:px-10 md:pb-16">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                className="rounded-2xl border border-outline bg-forground p-5 transition hover:border-hover"
                key={feature.title}
              >
                <div className="inline-flex size-9 items-center justify-center rounded-lg bg-secondary">
                  <Icon className="size-4 text-text" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-text">{feature.title}</h2>
                <p className="mt-2 text-sm text-text-secondary">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
