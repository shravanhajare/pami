// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "PamiMac",
    platforms: [.macOS(.v13)], // MenuBarExtra + SMAppService both require macOS 13+
    targets: [
        .executableTarget(name: "PamiMac", path: "Sources/PamiMac")
    ]
)
