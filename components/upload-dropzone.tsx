"use client";

import { useRef, useState, useTransition } from "react";
import { UploadCloud } from "lucide-react";
import { uploadLogAction } from "@/app/actions/upload";

export function UploadDropzone({ workspaceId }: { workspaceId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [sourceLabel, setSourceLabel] = useState("Manual upload");
  const [environment, setEnvironment] = useState("Production");
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File) {
    const text = await file.text();
    const form = new FormData();
    form.set("workspaceId", workspaceId);
    form.set("fileName", file.name);
    form.set("content", text);
    form.set("sourceLabel", sourceLabel);
    form.set("environment", environment);

    startTransition(async () => {
      const result = await uploadLogAction(form);
      setStatus(result.message);
      if (result.ok) window.location.reload();
    });
  }

  return (
    <div className="glass rounded-[28px] border border-dashed border-cyan-300/30 p-8 text-center">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400/10 text-cyan-300">
          <UploadCloud className="h-8 w-8" />
        </div>
        <h3 className="mt-5 text-2xl font-semibold">Drag & drop log files here</h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Upload plain text logs, JSON lines, or JSON arrays. The dashboard parses the content and generates real charts from uploaded data.
        </p>
      </div>

      <div className="mx-auto mt-6 grid max-w-3xl gap-3 md:grid-cols-2">
        <input className="input" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="Source label" />
        <select className="input" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
          <option>Production</option>
          <option>UAT</option>
          <option>Development</option>
          <option>DR</option>
        </select>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button className="btn-primary" onClick={() => inputRef.current?.click()} disabled={pending}>
          {pending ? "Uploading..." : "Choose file"}
        </button>
        <label className="btn-secondary cursor-pointer">
          Select log file
          <input
            ref={inputRef}
            type="file"
            accept=".log,.txt,.json,.jsonl"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
      </div>

      {status ? <p className="mt-4 text-sm text-cyan-300">{status}</p> : null}
    </div>
  );
}
