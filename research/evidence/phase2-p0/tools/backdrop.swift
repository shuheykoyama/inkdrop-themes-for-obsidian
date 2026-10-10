// Phase 2B (V-32), diagnostic only: a borderless backdrop window placed directly behind Inkdrop so the
// translucent (acrylic) window blends with a controlled, private background instead of the desktop.
// It never takes focus (accessory app, non-activating) and is closed by terminating the process.
//
// usage: swift backdrop.swift <gray|pattern> <x> <y> <w> <h> [activate]
//   x, y: top-left corner in screen points (same origin as macOS screencapture -R)
//   activate: make this (window-less in the foreground sense) app active after 1 s, so Inkdrop loses
//             focus while staying in front (used for the inactive-window capture)
import AppKit

let args = CommandLine.arguments
let mode = args.count > 1 ? args[1] : "gray"
let x = args.count > 2 ? Double(args[2])! : 200
let y = args.count > 3 ? Double(args[3])! : 100
let w = args.count > 4 ? Double(args[4])! : 1400
let h = args.count > 5 ? Double(args[5])! : 900

// sRGB colours so the backdrop is described by exact component values.
func srgb(_ r: Double, _ g: Double, _ b: Double) -> NSColor {
    NSColor(srgbRed: r / 255, green: g / 255, blue: b / 255, alpha: 1)
}

final class BackdropView: NSView {
    override func draw(_ dirtyRect: NSRect) {
        if mode == "pattern" {
            // Vertical stripes, 100 pt wide, cycling through saturated colours plus white and black.
            let stripes = [srgb(255, 255, 255), srgb(0, 0, 0), srgb(255, 0, 0), srgb(0, 255, 0), srgb(0, 0, 255), srgb(255, 255, 0)]
            var i = 0
            var sx = 0.0
            while sx < bounds.width {
                stripes[i % stripes.count].setFill()
                NSRect(x: sx, y: 0, width: 100, height: bounds.height).fill()
                sx += 100
                i += 1
            }
        } else {
            srgb(128, 128, 128).setFill() // neutral mid grey
            bounds.fill()
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory) // no Dock icon, no menu bar
let screenH = NSScreen.main!.frame.height
let frame = NSRect(x: x, y: screenH - y - h, width: w, height: h) // convert top-left to AppKit bottom-left
let win = NSWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
// One level below normal windows: Inkdrop always stays in front, even when this app becomes active.
win.level = NSWindow.Level(rawValue: NSWindow.Level.normal.rawValue - 1)
win.hasShadow = false
win.isOpaque = true
win.contentView = BackdropView(frame: NSRect(origin: .zero, size: frame.size))
win.orderFrontRegardless() // shown without activating the app
if args.count > 6 && args[6] == "activate" {
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { app.activate(ignoringOtherApps: true) }
}
app.run()
