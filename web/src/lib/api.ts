import type {
  LifecycleStatus,
  OverviewResponse,
  SkillDiffResponse,
  SkillHistoryResponse,
  SkillSourceResponse,
  VisibilityStatus,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchOverview(): Promise<OverviewResponse> {
  return request<OverviewResponse>('/api/overview');
}

export function fetchSkillSource(name: string): Promise<SkillSourceResponse> {
  return request<SkillSourceResponse>(`/api/skills/${encodeURIComponent(name)}/source`);
}

export function fetchSkillHistory(name: string): Promise<SkillHistoryResponse> {
  return request<SkillHistoryResponse>(`/api/skills/${encodeURIComponent(name)}/history`);
}

export function fetchSkillDiff(name: string, from: string, to?: string): Promise<SkillDiffResponse> {
  const params = new URLSearchParams({ from });
  if (to) params.set('to', to);
  return request<SkillDiffResponse>(`/api/skills/${encodeURIComponent(name)}/diff?${params.toString()}`);
}

export function updateVisibility(skill: string, status: VisibilityStatus, note = 'web toggle') {
  return request('/api/visibility', {
    method: 'POST',
    body: JSON.stringify({ skill, status, note }),
  });
}

export function updateLifecycle(skill: string, status: LifecycleStatus, note = 'web update') {
  return request('/api/lifecycle', {
    method: 'POST',
    body: JSON.stringify({ skill, status, note }),
  });
}

export function triggerRefresh() {
  return request<{ ok: boolean; count: number; refreshedAt: string }>('/api/refresh', {
    method: 'POST',
  });
}
