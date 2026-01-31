/// StatusTimelineView.swift
/// Flent Secured v2 - Application Status Timeline Component
///
/// Vertical timeline showing application progress steps:
/// Application Sent -> In Review -> Account Status
///
/// Figma: 41-11206, 41-11825 - Status Timeline
/// Design Specifications:
/// - Orange filled dot (8x8pt) for complete steps
/// - Orange outline dot for current step
/// - Gray outline dot for pending steps
/// - Vertical connecting line (1pt) between dots
/// - Step title: 12pt SemiBold, brand500 (complete/current) or textMuted
/// - Step subtitle: 14pt Regular, textSecondary

import SwiftUI

// MARK: - Status Timeline View

struct StatusTimelineView: View {
    let steps: [ApplicationStatusStep]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                StatusTimelineStepView(
                    step: step,
                    isLast: index == steps.count - 1
                )
            }
        }
    }
}

// MARK: - Timeline Step View

private struct StatusTimelineStepView: View {
    let step: ApplicationStatusStep
    let isLast: Bool

    private let dotSize: CGFloat = 8
    private let lineWidth: CGFloat = 1
    private let dotAreaWidth: CGFloat = 24

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            // Timeline column (dot + line)
            VStack(spacing: 0) {
                // Dot
                timelineDot
                    .frame(width: dotSize, height: dotSize)

                // Connecting line (if not last)
                if !isLast {
                    Rectangle()
                        .fill(lineColor)
                        .frame(width: lineWidth)
                        .frame(maxHeight: .infinity)
                }
            }
            .frame(width: dotAreaWidth)

            // Content column (title + subtitle)
            VStack(alignment: .leading, spacing: Spacing.xxxs) {
                Text(step.title)
                    .font(Typography.bodySmSemiBold)
                    .foregroundColor(titleColor)

                Text(step.subtitle)
                    .font(Typography.bodyMd2)
                    .foregroundColor(AppColors.textSecondary)
            }
            .padding(.bottom, isLast ? 0 : Spacing.lg)

            Spacer()
        }
    }

    // MARK: - Timeline Dot

    @ViewBuilder
    private var timelineDot: some View {
        if step.isComplete {
            // Filled orange dot
            Circle()
                .fill(AppColors.brand500)
        } else if step.isCurrent {
            // Orange outline dot with pulse animation
            Circle()
                .stroke(AppColors.brand500, lineWidth: 1.5)
                .background(
                    Circle()
                        .fill(AppColors.brand500.opacity(0.2))
                )
        } else {
            // Gray outline dot
            Circle()
                .stroke(AppColors.black400, lineWidth: 1)
        }
    }

    // MARK: - Colors

    private var titleColor: Color {
        if step.isComplete || step.isCurrent {
            return AppColors.brand500
        }
        return AppColors.textMuted
    }

    private var lineColor: Color {
        if step.isComplete {
            return AppColors.brand500.opacity(0.3)
        }
        return AppColors.black400
    }
}

// MARK: - Previews

#Preview("In Review State") {
    let steps = [
        ApplicationStatusStep(
            title: "Application Sent",
            subtitle: "Submitted on 27 Jan 2026",
            isComplete: true,
            isCurrent: false
        ),
        ApplicationStatusStep(
            title: "In Review",
            subtitle: "Approximately 24 hrs",
            isComplete: false,
            isCurrent: true
        ),
        ApplicationStatusStep(
            title: "Account Status",
            subtitle: "Pending",
            isComplete: false,
            isCurrent: false
        )
    ]

    return ZStack {
        AppColors.backgroundPrimary
            .ignoresSafeArea()

        StatusTimelineView(steps: steps)
            .padding(Spacing.lg)
    }
}

#Preview("Approved State") {
    let steps = [
        ApplicationStatusStep(
            title: "Application Sent",
            subtitle: "Submitted on 27 Jan 2026",
            isComplete: true,
            isCurrent: false
        ),
        ApplicationStatusStep(
            title: "In Review",
            subtitle: "Completed",
            isComplete: true,
            isCurrent: false
        ),
        ApplicationStatusStep(
            title: "Account Status",
            subtitle: "Approved",
            isComplete: true,
            isCurrent: true
        )
    ]

    return ZStack {
        AppColors.backgroundPrimary
            .ignoresSafeArea()

        StatusTimelineView(steps: steps)
            .padding(Spacing.lg)
    }
}
