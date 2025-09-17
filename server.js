(async () => {
  try {
    await import("./server/index.mjs");
  } catch (error) {
    console.error("Failed to start server/index.mjs", error);
    process.exitCode = 1;
  }
})();
