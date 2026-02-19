# Reuse shared components — never rebuild per screen

## Problem
Rebuilding a TextInput or Button per screen creates visual inconsistency and maintenance burden. Each copy drifts from the design system independently. When the design system updates, N copies need updating instead of 1.

## Solution
Import from `@/src/components` barrel. Available shared components: Text, TextInput, PhoneInput, OTPInput, PrimaryButton, TextButton, Screen, Logo, DottedPattern, DocumentUploadCard, FileUploadZone. If a screen needs customization, extend the shared component with props — don't fork it.

## Source
buildbot/learnings/buildbot-learnings.md
