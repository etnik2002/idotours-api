#!/usr/bin/env node
import { FastMCP, Tool, Resource, Prompt } from "@modelcontextprotocol/sdk";
import fetch from "node-fetch";

const APP_NAME = process.env.MCP_APP_NAME || "My Node Backend Connector";
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:3000"; // points at your server.js
const API_KEY = process.env.API_KEY || ""; // optional

// Init
const mcp = new FastMCP(APP_NAME);

// ---------------------------
// Helpers
// ---------------------------
async function apiGet(path, params = {}) {
  const url = new URL(path, BACKEND_BASE_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "Authorization": `Bearer ${API_KEY}` } : {})
    }
  });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status}`);
  }
  return res.json();
}

// ---------------------------
// Resource (docs)
// ---------------------------
mcp.resource("myapp://docs/guide", () => new Resource({
  uri: "myapp://docs/guide",
  mimeType: "text/markdown",
  text: `# MyApp Connector Guide

Use tools like \`getLeads\`, \`getUsers\`, or \`searchBookings\` to fetch data from your backend.
Always cite using the returned URLs if available.`
}));

// ---------------------------
// Prompts
// ---------------------------
mcp.prompt("summarize-leads", () =>
  "Summarize the fetched leads in 3 bullet points with source attribution."
);

// ---------------------------
// Tools (map to your Express routes)
// ---------------------------

// GET /leads
mcp.tool("getLeads", async () => {
  const data = await apiGet("/leads");
  return { leads: data.data || [] };
});

// Example: GET /user/:id
mcp.tool("getUser", async ({ id }) => {
  const data = await apiGet(`/user/${id}`);
  return data;
});

// Example: GET /booking/search?q=
mcp.tool("searchBookings", async ({ q }) => {
  const data = await apiGet("/booking/search", { q });
  return data;
});

// ---------------------------
// Start MCP server
// ---------------------------
mcp.start();
