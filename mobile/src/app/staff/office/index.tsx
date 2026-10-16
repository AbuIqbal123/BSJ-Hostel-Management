import { useState } from "react";
import { router } from "expo-router";
import { Pressable, Share, StyleSheet, Text } from "react-native";

import { HallButton } from "@/components/hall-button";
import { OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { registerCsv } from "@/office";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const LINKS: { href: "/staff/office/settings" | "/staff/office/blocks" | "/staff/office/destinations" | "/staff/office/residents" | "/staff/office/staff" | "/staff/office/sms" | "/staff/office/audit"; label: string; detail: string }[] = [
  { href: "/staff/office/settings", label: "Settings", detail: "Hours, grace, seasons, guest rules, and texts" },
  { href: "/staff/office/blocks", label: "Blocks and rooms", detail: "Add a block or a room, or retire one" },
  { href: "/staff/office/destinations", label: "Destinations", detail: "Inactive places stay here and stay off the resident list" },
  { href: "/staff/office/residents", label: "Residents", detail: "Create, edit, suspend, reissue a pass, or reset a password" },
  { href: "/staff/office/staff", label: "Staff", detail: "Create, edit, or reset a password" },
  { href: "/staff/office/sms", label: "Text messages", detail: "Late and return notices that were sent" },
  { href: "/staff/office/audit", label: "Audit", detail: "What the hall recorded" },
];

export default function OfficeHome() {
  const colors = useHallColors();
  const { staffText } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const exportRegister = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    const reply = await staffText("/admin/register/export");
    const refused = replyError(reply);
    if (refused || !reply.ok || typeof reply.data !== "string") {
      setError(refused ?? "The register export was not a CSV");
      setBusy(false);
      return;
    }
    const csv = registerCsv(reply.data);
    if (!csv) {
      setError("The register export was not a CSV");
      setBusy(false);
      return;
    }
    try {
      await Share.share({ message: csv });
    } catch {
      setError("The register could not be shared");
    }
    setBusy(false);
  };

  return (
    <OfficeFrame title="Office">
      {LINKS.map((link) => (
        <Pressable
          key={link.href}
          accessibilityRole="button"
          accessibilityLabel={`${link.label}. ${link.detail}`}
          onPress={() => router.push(link.href)}
          style={({ pressed }) => [styles.link, { borderColor: colors.line }, pressed && styles.pressed]}
        >
          <Text style={[text.button, { color: colors.ink }]}>{link.label}</Text>
          <Text style={[text.error, { color: colors.inkSoft }]}>{link.detail}</Text>
        </Pressable>
      ))}
      <HallButton label="Export register" busy={busy} onPress={() => void exportRegister()} />
      <OfficeError message={error} />
    </OfficeFrame>
  );
}

const styles = StyleSheet.create({
  link: { gap: 4, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.6 },
});
