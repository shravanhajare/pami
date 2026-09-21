import Foundation

struct RequestedAction: Codable {
    let command: String?
}

struct PamiTask: Codable, Identifiable {
    let id: String
    let title: String
    let type: String
    let status: String
    let source: String
    let prompt: String?
    let approval_decision: String?
    let requested_action: RequestedAction?
}

struct HeartbeatResponse: Codable {
    let status: String // "pending" | "trusted"
    let pairing_code: String?
    let tasks: [PamiTask]
    // The website's Settings page is the single source of truth for this —
    // see AppState.voiceResponsesEnabled. Optional/defaulted because
    // "pending" responses don't include it.
    let voice_responses_enabled: Bool?
}

struct PairInitResponse: Codable {
    let pairing_code: String
    let device_token: String
}

enum PamiAPIError: Error {
    case server(status: Int, message: String)
    case network
}

// Plain HTTPS calls to the 5 Supabase Edge Functions — no WebSocket client,
// no supabase-swift SDK. The Mac never holds a Supabase Auth session; it
// authenticates with the anon key (platform JWT gate) plus its own device
// token (real authorization, checked in function code).
struct PamiAPI {
    private let session = URLSession(configuration: .ephemeral)

    private func functionURL(_ name: String) -> URL {
        Config.supabaseURL.appendingPathComponent("functions/v1/\(name)")
    }

    private func request(_ name: String, deviceToken: String? = nil, body: [String: Any] = [:]) async throws -> Data {
        var request = URLRequest(url: functionURL(name))
        request.httpMethod = "POST"
        request.setValue("Bearer \(Config.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let deviceToken {
            request.setValue(deviceToken, forHTTPHeaderField: "X-Device-Token")
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw PamiAPIError.network }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"] ?? "HTTP \(http.statusCode)"
            throw PamiAPIError.server(status: http.statusCode, message: message)
        }
        return data
    }

    func pairInit(deviceId: String, name: String, osVersion: String) async throws -> PairInitResponse {
        let data = try await request("device-pair-init", body: [
            "device_id": deviceId,
            "name": name,
            "os_version": osVersion,
        ])
        return try JSONDecoder().decode(PairInitResponse.self, from: data)
    }

    func heartbeat(deviceToken: String, agentVersion: String, osVersion: String, state: String) async throws -> HeartbeatResponse {
        let data = try await request("device-heartbeat", deviceToken: deviceToken, body: [
            "agent_version": agentVersion,
            "os_version": osVersion,
            "state": state,
        ])
        return try JSONDecoder().decode(HeartbeatResponse.self, from: data)
    }

    func createTask(deviceToken: String, title: String = "Activate PAMI", type: String = "manual_activation", prompt: String? = nil) async throws {
        var body: [String: Any] = ["title": title, "type": type]
        if let prompt { body["prompt"] = prompt }
        _ = try await request("device-create-task", deviceToken: deviceToken, body: body)
    }

    func ackTask(deviceToken: String, taskId: String, status: String, result: String? = nil) async throws {
        var body: [String: Any] = ["task_id": taskId, "status": status]
        if let result { body["result"] = result }
        _ = try await request("device-task-ack", deviceToken: deviceToken, body: body)
    }

    func requestApproval(deviceToken: String, taskId: String, command: String) async throws {
        _ = try await request("device-request-approval", deviceToken: deviceToken, body: [
            "task_id": taskId,
            "requested_action": ["command": command],
        ])
    }
}
