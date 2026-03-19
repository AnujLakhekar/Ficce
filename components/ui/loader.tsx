import React from "react";
import { Loader as RSuteLoader } from "rsuite";
import 'rsuite/dist/rsuite-no-reset.css';

const Loader = ({content}: {content: string}) => {
  return (
    <>
      <div className="loader-container">
        <RSuteLoader  center content={content} />
      </div>
      <style>
        {`
    .loader-container {
      height: 100vh;
      width: 100vw;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: #fff;
    }
    .rs-theme-dark,.rs-theme-high-contrast {
      .loader-container {
        background-color: #fff;
      }
    }
    `}
      </style>
    </>
  );
};

export default Loader;
