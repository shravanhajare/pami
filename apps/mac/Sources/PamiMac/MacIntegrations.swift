import Foundation

// Controlled AppleScript automation for Notes/Reminders/Calendar — per the
// project's own mandate, this does NOT touch Apple Notes' internal database
// files directly; it drives the real apps via Apple Events, the same
// mechanism System Events/AppleScript has always used. macOS will prompt
// for one-time Automation permission the first time each app is
// controlled; that's an unavoidable, expected system dialog.
enum MacIntegrations {
    struct ScriptError: Error {
        let message: String
    }

    private static func runAppleScript(_ source: String) throws -> String {
        var errorDict: NSDictionary?
        guard let script = NSAppleScript(source: source) else {
            throw ScriptError(message: "could not compile AppleScript")
        }
        let result = script.executeAndReturnError(&errorDict)
        if let errorDict {
            let message = errorDict[NSAppleScript.errorMessage] as? String ?? "unknown AppleScript error"
            throw ScriptError(message: message)
        }
        return result.stringValue ?? ""
    }

    // MARK: - Notes

    static func createNote(title: String, body: String) throws -> String {
        let escapedTitle = escape(title)
        let escapedBody = escape(body)
        _ = try runAppleScript("""
        tell application "Notes"
            tell account "iCloud"
                make new note at folder "Notes" with properties {name:"\(escapedTitle)", body:"\(escapedTitle)<br><br>\(escapedBody)"}
            end tell
        end tell
        """)
        return "Created note \"\(title)\" in Apple Notes."
    }

    // MARK: - Reminders

    static func createReminder(text: String, dueDate: Date?) throws -> String {
        let escapedText = escape(text)
        var script = """
        tell application "Reminders"
            tell list "Reminders"
                make new reminder with properties {name:"\(escapedText)"\(dueDate != nil ? ", remind me date:(current date) + \(Int(dueDate!.timeIntervalSinceNow))" : "")}
            end tell
        end tell
        """
        if dueDate == nil {
            script = """
            tell application "Reminders"
                tell list "Reminders"
                    make new reminder with properties {name:"\(escapedText)"}
                end tell
            end tell
            """
        }
        _ = try runAppleScript(script)
        return "Created reminder \"\(text)\" in Apple Reminders."
    }

    // MARK: - Calendar

    static func todayEvents() throws -> String {
        let script = """
        set output to ""
        tell application "Calendar"
            set today to current date
            set startOfDay to today - (time of today)
            set endOfDay to startOfDay + (24 * 60 * 60)
            repeat with cal in calendars
                repeat with evt in (every event of cal whose start date >= startOfDay and start date < endOfDay)
                    set output to output & (summary of evt) & " at " & (time string of (start date of evt)) & "\\n"
                end repeat
            end repeat
        end tell
        return output
        """
        let result = try runAppleScript(script)
        if result.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "No events on your calendar today."
        }
        return "Today's events:\n\(result)"
    }

    private static func escape(_ s: String) -> String {
        s.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
    }
}
