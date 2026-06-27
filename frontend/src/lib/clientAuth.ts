"use client";

const COOKIE = "silaa_token";

export function getClientToken(): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.split("=")[1];
}

export function clearClientToken() {
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}
