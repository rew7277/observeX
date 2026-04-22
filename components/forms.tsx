"use client";

import { ReactNode, useState, useTransition } from "react";
import { createAlertRuleAction, createApiSourceAction, createInviteAction, updateWorkspaceProfileAction } from "@/app/actions/workspace";

function ActionForm({ action, children }: { action: (formData: FormData) => Promise<{ ok: boolean; message: string }>; children: (pending: boolean, status: string) => ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState("");

  return (
    <form action={(formData) => startTransition(async () => {
      const result = await action(formData);
      setStatus(result.message);
      if (result.ok) window.location.reload();
    })}>
      {children(pending, status)}
    </form>
  );
}

export function WorkspaceProfileForm({ workspace }: { workspace: any }) {
  return (
    <ActionForm action={updateWorkspaceProfileAction}>
      {(pending, status) => (
        <div className="space-y-4">
          <input type="hidden" name="workspaceId" value={workspace.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <input name="name" className="input" defaultValue={workspace.name} placeholder="Workspace name" />
            <input name="slug" className="input" defaultValue={workspace.slug} placeholder="Workspace slug" />
            <input name="billingEmail" className="input" defaultValue={workspace.billingEmail || ""} placeholder="Billing email" />
            <input name="domain" className="input" defaultValue={workspace.domain || ""} placeholder="Custom domain" />
            <input name="retentionDays" type="number" className="input" defaultValue={workspace.retentionDays} placeholder="Retention days" />
            <input name="maxMonthlyIngestMb" type="number" className="input" defaultValue={workspace.maxMonthlyIngestMb || 512} placeholder="Monthly ingest limit (MB)" />
            <input name="maxUsers" type="number" className="input" defaultValue={workspace.maxUsers || 5} placeholder="Max users" />
            <select name="ingestionMode" className="input" defaultValue={workspace.ingestionMode}>
              <option value="manual-upload">Manual upload</option>
              <option value="hybrid">Hybrid upload + scheduled source</option>
              <option value="scheduled-only">Scheduled sources</option>
            </select>
            <select name="logStorageMode" className="input" defaultValue={workspace.logStorageMode}>
              <option value="database">Database only</option>
              <option value="s3-archive">S3 archive + database metadata</option>
            </select>
            <input name="s3Bucket" className="input" defaultValue={workspace.s3Bucket || ""} placeholder="S3 bucket" />
            <input name="s3Region" className="input" defaultValue={workspace.s3Region || ""} placeholder="S3 region" />
            <input name="s3Prefix" className="input" defaultValue={workspace.s3Prefix || ""} placeholder="S3 prefix" />
          </div>
          <textarea name="description" className="input min-h-32" defaultValue={workspace.description || ""} placeholder="Workspace description" />
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save settings"}</button>
            {status ? <span className="text-sm text-cyan-300">{status}</span> : null}
          </div>
        </div>
      )}
    </ActionForm>
  );
}

export function InviteMemberForm({ workspaceId }: { workspaceId: string }) {
  return (
    <ActionForm action={createInviteAction}>
      {(pending, status) => (
        <div className="space-y-4">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <div className="grid gap-4 md:grid-cols-[1.2fr,0.8fr,auto]">
            <input name="email" className="input" placeholder="member@company.com" />
            <select name="role" className="input" defaultValue="viewer">
              <option value="admin">Admin</option>
              <option value="developer">Developer</option>
              <option value="tester">Tester</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="btn-primary" disabled={pending}>{pending ? "Inviting..." : "Invite"}</button>
          </div>
          {status ? <span className="text-sm text-cyan-300">{status}</span> : null}
        </div>
      )}
    </ActionForm>
  );
}

export function SourceForm({ workspaceId }: { workspaceId: string }) {
  return (
    <ActionForm action={createApiSourceAction}>
      {(pending, status) => (
        <div className="space-y-4">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <div className="grid gap-4 md:grid-cols-2">
            <input name="name" className="input" placeholder="Source name" />
            <select name="type" className="input" defaultValue="api">
              <option value="api">API</option>
              <option value="s3">S3</option>
            </select>
            <input name="endpointUrl" className="input" placeholder="Endpoint URL" />
            <input name="bucketName" className="input" placeholder="Bucket name" />
            <input name="region" className="input" placeholder="Region" />
            <input name="prefix" className="input" placeholder="Prefix" />
            <input name="schedule" className="input" placeholder="Schedule (cron or text)" />
            <select name="authType" className="input" defaultValue="bearer">
              <option value="none">None</option>
              <option value="bearer">Bearer</option>
              <option value="basic">Basic</option>
              <option value="iam">IAM/Role</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={pending}>{pending ? "Adding..." : "Add source"}</button>
            {status ? <span className="text-sm text-cyan-300">{status}</span> : null}
          </div>
        </div>
      )}
    </ActionForm>
  );
}

export function AlertRuleForm({ workspaceId }: { workspaceId: string }) {
  return (
    <ActionForm action={createAlertRuleAction}>
      {(pending, status) => (
        <div className="space-y-4">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <input name="name" className="input xl:col-span-2" placeholder="Rule name" />
            <select name="metric" className="input" defaultValue="errorRate">
              <option value="errorRate">Error rate</option>
              <option value="avgLatency">Average latency</option>
              <option value="p95Latency">P95 latency</option>
              <option value="warnCount">Warn count</option>
              <option value="criticalSignals">Critical signals</option>
              <option value="piiEvents">Sensitive-data events</option>
            </select>
            <select name="operator" className="input" defaultValue=">=">
              <option value=">">&gt;</option>
              <option value=">=">&gt;=</option>
              <option value="<">&lt;</option>
              <option value="<=">&lt;=</option>
            </select>
            <input name="threshold" type="number" className="input" placeholder="Threshold" />
            <select name="severity" className="input" defaultValue="high">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Create alert rule"}</button>
            {status ? <span className="text-sm text-cyan-300">{status}</span> : null}
          </div>
        </div>
      )}
    </ActionForm>
  );
}
