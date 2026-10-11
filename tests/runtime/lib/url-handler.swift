// Read-only: print which application macOS uses for obsidian:// URLs, and every registered candidate.
// Used by tests/runtime/current-installer.sh to check that a second Obsidian copy did not take over.
import AppKit

let url = URL(string: "obsidian://open")!
print("default:", NSWorkspace.shared.urlForApplication(toOpen: url)?.path ?? "none")
for app in NSWorkspace.shared.urlsForApplications(toOpen: url) {
    print("candidate:", app.path)
}
