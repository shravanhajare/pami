import Foundation

// The anon key is meant to be public — it unlocks nothing beyond the 5
// narrow Edge Functions this app calls, no direct table access. Real device
// authorization happens via the Keychain-stored device token (see
// Keychain.swift / PamiAPI.swift), not this key.
//
enum Config {
    static let supabaseURL = URL(string: "https://ohgmihwalxqrshldwegw.supabase.co")!
    static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oZ21paHdhbHhxcnNobGR3ZWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5ODQ4MTgsImV4cCI6MjEwNTU2MDgxOH0.-6iP6pFSKUBRdiqckykWmWJRWt7h9HRY2vGJS4Ar5x4"
    static let dashboardURL = URL(string: "http://localhost:3000/dashboard")!
}
