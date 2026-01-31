// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FlentSecured",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "FlentSecured", targets: ["FlentSecured"]),
    ],
    dependencies: [
        // Backend - Supabase Swift SDK
        .package(url: "https://github.com/supabase/supabase-swift", from: "2.0.0"),

        // Animations
        .package(url: "https://github.com/airbnb/lottie-ios", from: "4.4.0"),
        .package(url: "https://github.com/EmergeTools/Pow", from: "1.0.0"),
        .package(url: "https://github.com/simibac/ConfettiSwiftUI", from: "1.1.0"),

        // Media (NukeUI is included in Nuke 12+)
        .package(url: "https://github.com/kean/Nuke", from: "12.0.0"),

        // UI Helpers
        .package(url: "https://github.com/markiv/SwiftUI-Shimmer", from: "1.4.0"),
        .package(url: "https://github.com/siteline/swiftui-introspect", from: "1.1.0"),

        // Security
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess", from: "4.2.2"),

        // Analytics
        .package(url: "https://github.com/PostHog/posthog-ios", from: "3.2.0"),
        .package(url: "https://github.com/getsentry/sentry-cocoa", from: "8.20.0"),

        // Testing (disabled - test target outside package root)
        // .package(url: "https://github.com/pointfreeco/swift-snapshot-testing", from: "1.15.0"),
    ],
    targets: [
        .target(
            name: "FlentSecured",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift"),
                .product(name: "Lottie", package: "lottie-ios"),
                .product(name: "Pow", package: "Pow"),
                .product(name: "ConfettiSwiftUI", package: "ConfettiSwiftUI"),
                .product(name: "Nuke", package: "Nuke"),
                .product(name: "NukeUI", package: "Nuke"),
                .product(name: "Shimmer", package: "SwiftUI-Shimmer"),
                .product(name: "SwiftUIIntrospect", package: "swiftui-introspect"),
                .product(name: "KeychainAccess", package: "KeychainAccess"),
                .product(name: "PostHog", package: "posthog-ios"),
                .product(name: "Sentry", package: "sentry-cocoa"),
            ],
            path: ".",
            exclude: ["Package.swift"],
            resources: [
                .process("Resources/Assets.xcassets"),
                .process("Resources/Animations"),
                .process("Resources/Fonts"),
            ]
        ),
        // Test target disabled - outside package root
        // .testTarget(
        //     name: "FlentSecuredTests",
        //     dependencies: [
        //         "FlentSecured",
        //         .product(name: "SnapshotTesting", package: "swift-snapshot-testing"),
        //     ],
        //     path: "../FlentSecuredTests"
        // ),
    ]
)
