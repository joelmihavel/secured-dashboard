/// ShareSheet.swift
/// Flent Secured v2 - Share Sheet Component
///
/// UIActivityViewController wrapper for sharing content

import SwiftUI
import UIKit

// MARK: - Share Sheet

/// SwiftUI wrapper for UIActivityViewController
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    var excludedActivityTypes: [UIActivity.ActivityType]? = nil
    var onComplete: ((Bool) -> Void)? = nil

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(
            activityItems: items,
            applicationActivities: nil
        )
        controller.excludedActivityTypes = excludedActivityTypes
        controller.completionWithItemsHandler = { _, completed, _, _ in
            onComplete?(completed)
        }
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {
        // No updates needed
    }
}

// MARK: - Share Button Modifier

extension View {
    /// Adds a share button that presents a share sheet
    func shareButton<Content: View>(
        items: [Any],
        @ViewBuilder content: () -> Content
    ) -> some View {
        self.overlay(alignment: .topTrailing) {
            ShareLink(items: items, content: content)
        }
    }
}

// MARK: - Share Link Button

/// A button that presents a share sheet
struct ShareLink<Label: View>: View {
    let items: [Any]
    @ViewBuilder let label: Label
    @State private var isPresented = false

    init(items: [Any], @ViewBuilder content: () -> Label) {
        self.items = items
        self.label = content()
    }

    var body: some View {
        Button {
            isPresented = true
        } label: {
            label
        }
        .sheet(isPresented: $isPresented) {
            ShareSheet(items: items)
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 20) {
        ShareLink(items: ["Test share content"]) {
            Label("Share", systemImage: "square.and.arrow.up")
        }
        .buttonStyle(.borderedProminent)
    }
    .padding()
}
