"use client";

import { type ReactNode } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props = {
  children?: ReactNode;
  file: string;
  onLoadSuccess: (numPages: number) => void;
  pageNumber: number;
  width: number;
};

export default function PdfPagePreview({
  children,
  file,
  onLoadSuccess,
  pageNumber,
  width,
}: Props) {
  return (
    <div className="relative mx-auto w-fit">
      <Document
        file={file}
        onLoadSuccess={({ numPages }) => {
          onLoadSuccess(numPages || 1);
        }}
        onLoadError={(err) => {
          console.error("PDF LOAD ERROR:", err);
        }}
      >
        <Page
          pageNumber={pageNumber}
          renderAnnotationLayer={false}
          renderTextLayer={false}
          width={width}
        />
      </Document>
      {children}
    </div>
  );
}
