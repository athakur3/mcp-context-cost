import XCTest

/// The shape of bbingz/engram, macos/EngramMCPTests/EngramMCPExecutableTests.swift
/// at d97d02575e1b6362b628c649a7e3337193942323 — the one file the reading of
/// 2026-09-07 published as "names the project, no badge" under a verdict v1 had
/// made. Its only occurrence of the name is a temporary file's name.
final class EngramMCPExecutableTests: XCTestCase {
    func testListVisibleWritesToItsOwnStore() throws {
        let temp = FileManager.default.temporaryDirectory
        let store = temp.appendingPathComponent("mcp-context-cost-list-visible.sqlite")
        defer { try? FileManager.default.removeItem(at: store) }

        let harness = try Harness(storePath: store)
        let visible = try harness.run(tool: "list_visible")

        XCTAssertEqual(visible.count, 0)
        XCTAssertTrue(FileManager.default.fileExists(atPath: store.path))
    }
}
