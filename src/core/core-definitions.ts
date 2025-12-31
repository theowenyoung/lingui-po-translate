import { TServiceType } from "../services/service-definitions";
import { TMatcherType } from "../matchers/matcher-definitions";

export type TSet = Map<string, string | null>;

export interface CoreArgs {
  src: TSet;
  srcLng: string;
  srcFile: string;
  oldTarget: TSet | null;
  targetLng: string;
  service: TServiceType;
  serviceConfig: string | null;
  matcher: TMatcherType;
  prompt: string;
  sourceOverride: SourceOverrideMap;
  baseUrl: string | null;
  debug: boolean;
}

export interface TChangeSet {
  skipped: TSet;
  added: TSet;
  updated: TSet;
  deleted: TSet | null;
}

export interface TServiceInvocation {
  inputs: TSet;
  results: TSet;
}

export interface CoreResults {
  changeSet: TChangeSet;
  serviceInvocation: TServiceInvocation | null;
  newTarget: TSet;
}

export interface CliArgs extends Record<string, string | boolean | undefined> {
  srcFile: string;
  srcLng: string;
  srcFormat: string;
  targetFile: string;
  targetLng: string;
  targetFormat: string;
  service: string;
  serviceConfig?: string;
  matcher: string;
  prompt?: string;
  sourceOverride?: string;
  baseUrl?: string;
  debug?: boolean;
}

/**
 * Parsed source language override mapping
 * e.g., "zh-Hant:zh-Hans,pt-BR:pt-PT" -> { "zh-Hant": "zh-Hans", "pt-BR": "pt-PT" }
 */
export type SourceOverrideMap = Map<string, string>;

/**
 * Parse source override string into a map
 */
export function parseSourceOverride(sourceOverride: string | undefined): SourceOverrideMap {
  const map = new Map<string, string>();
  if (!sourceOverride) {
    return map;
  }
  const pairs = sourceOverride.split(",");
  for (const pair of pairs) {
    const [target, source] = pair.split(":").map((s) => s.trim());
    if (target && source) {
      map.set(target, source);
    }
  }
  return map;
}
