// Step 11G G6 (research/14 §6.95): read-only report from the isolated Inkdrop of where its data lives, for
// tests/visual/g6-rules.mjs (isolationProblems). Every path the app itself reports, from several APIs, so
// one that is missing or differs cannot hide a profile mix-up. No note content, no account details.
(async () => {
  const tryGet = (f) => { try { return f() ?? null; } catch { return null; } };
  const remote = tryGet(() => require("@electron/remote"));
  return {
    inkdropVersion: inkdrop.appVersion ?? null,
    pid: tryGet(() => remote.process.pid),
    env: tryGet(() => remote.process.env.INKDROP_USER_DATA_PATH),
    paths: {
      userData: tryGet(() => remote.app.getPath("userData")),
      configFile: tryGet(() => inkdrop.config.getUserConfigPath()),
      configDir: tryGet(() => inkdrop.config.configDirPath),
      packageDirs: tryGet(() => inkdrop.packages.getPackageDirPaths()),
      db: tryGet(() => inkdrop.localDB.dbPath ?? inkdrop.localDB.name),
    },
  };
})();
