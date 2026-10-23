// Step 11G G6 (research/14 §6.95, §6.97): read-only report from the isolated Inkdrop of where its data lives,
// for tests/visual/g6-rules.mjs (isolationProblems). Every path the app itself reports, from several APIs, so
// one that is missing or differs cannot hide a profile mix-up; an API that is not there gives null, which the
// rules treat as "not confirmed". Also whether the main window shows the app (signed in) or a sign-in screen.
// No note content, no account details, nothing from the keychain.
(async () => {
  const tryGet = (f) => { try { return f() ?? null; } catch { return null; } };
  const remote = tryGet(() => require("@electron/remote"));
  return {
    inkdropVersion: inkdrop.appVersion ?? null,
    pid: tryGet(() => remote.process.pid),
    env: tryGet(() => remote.process.env.INKDROP_USER_DATA_PATH),
    // The note-taking layout exists only once signed in; the sign-in screen has none of it.
    mainUi: !!document.querySelector(".main-layout .editor-layout"),
    paths: {
      userData: tryGet(() => remote.app.getPath("userData")),
      configFile: tryGet(() => inkdrop.config.getUserConfigPath()),
      configDir: tryGet(() => inkdrop.config.configDirPath),
      packageDirs: tryGet(() => inkdrop.packages.getPackageDirPaths()),
      db: tryGet(() => inkdrop.localDB.dbPath),
    },
  };
})();
