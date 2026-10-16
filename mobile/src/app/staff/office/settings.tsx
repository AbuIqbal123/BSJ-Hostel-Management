import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { HallButton } from "@/components/hall-button";
import { OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { TextField } from "@/components/text-field";
import {
  LATE_PLACEHOLDERS,
  RETURN_PLACEHOLDERS,
  clockLabel,
  hoursFromFields,
  hoursPatch,
  noticesPatch,
  readHours,
  readNotices,
  seasonLabel,
  templateProblem,
  type HallHours,
  type HallNotices,
  type HoursFields,
} from "@/office";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

const EMPTY: HoursFields = {
  hallName: "",
  universityName: "",
  grace: "",
  summerStart: "",
  summerEnd: "",
  winterStart: "",
  winterEnd: "",
  summerSeason: "",
  winterSeason: "",
  permissionLead: "",
  guestMax: "",
  guestLead: "",
  scanWindow: "",
};

function fieldsFrom(hours: HallHours): HoursFields {
  return {
    hallName: hours.hallName,
    universityName: hours.universityName,
    grace: String(hours.graceMinutes),
    summerStart: clockLabel(hours.summerStart),
    summerEnd: clockLabel(hours.summerEnd),
    winterStart: clockLabel(hours.winterStart),
    winterEnd: clockLabel(hours.winterEnd),
    summerSeason: seasonLabel(hours.summerSeason),
    winterSeason: seasonLabel(hours.winterSeason),
    permissionLead: String(hours.permissionLeadMinutes),
    guestMax: String(hours.guestMaxDays),
    guestLead: String(hours.guestMinLeadDays),
    scanWindow: String(hours.scanWindowSeconds),
  };
}

export default function OfficeSettings() {
  const colors = useHallColors();
  const { staffRequest } = useSession();
  const [savedHours, setSavedHours] = useState<HallHours | null>(null);
  const [savedNotices, setSavedNotices] = useState<HallNotices | null>(null);
  const [fields, setFields] = useState<HoursFields>(EMPTY);
  const [late, setLate] = useState("");
  const [back, setBack] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof HoursFields) => (value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void staffRequest("/admin/settings").then((reply) => {
        if (!active) {
          return;
        }
        const hours = reply.ok ? readHours(reply.data) : null;
        if (!hours) {
          setError(replyError(reply) ?? "Settings didn't load");
          return;
        }
        setSavedHours(hours);
        setFields(fieldsFrom(hours));
      });
      void staffRequest("/admin/notifications").then((reply) => {
        if (!active) {
          return;
        }
        const notices = reply.ok ? readNotices(reply.data) : null;
        if (!notices) {
          setError(replyError(reply) ?? "Texts didn't load");
          return;
        }
        setSavedNotices(notices);
        setLate(notices.late);
        setBack(notices.back);
      });
      return () => {
        active = false;
      };
    }, [staffRequest]),
  );

  const save = async () => {
    if (busy || !savedHours || !savedNotices) {
      return;
    }
    const next = hoursFromFields(savedHours, fields);
    if (typeof next === "string") {
      setError(next);
      return;
    }
    const lateProblem = templateProblem(late, LATE_PLACEHOLDERS);
    const backProblem = templateProblem(back, RETURN_PLACEHOLDERS);
    if (lateProblem || backProblem) {
      setError(lateProblem ?? backProblem);
      return;
    }
    const hoursBody = hoursPatch(savedHours, next);
    const noticeBody = noticesPatch(savedNotices, { late, back });
    if (Object.keys(hoursBody).length === 0 && Object.keys(noticeBody).length === 0) {
      return;
    }
    setBusy(true);
    if (Object.keys(hoursBody).length > 0) {
      const reply = await staffRequest("/admin/settings", hoursBody, "PATCH");
      const refused = replyError(reply);
      const updated = reply.ok ? readHours(reply.data) : null;
      if (!updated) {
        setError(refused ?? "Settings didn't save");
        setBusy(false);
        return;
      }
      setSavedHours(updated);
      setFields(fieldsFrom(updated));
    }
    if (Object.keys(noticeBody).length > 0) {
      const reply = await staffRequest("/admin/notifications", noticeBody, "PATCH");
      const refused = replyError(reply);
      const updated = reply.ok ? readNotices(reply.data) : null;
      if (!updated) {
        setError(refused ?? "Texts didn't save");
        setBusy(false);
        return;
      }
      setSavedNotices(updated);
      setLate(updated.late);
      setBack(updated.back);
    }
    setBusy(false);
  };

  return (
    <OfficeFrame title="Settings">
      <Text style={[text.body, { color: colors.inkSoft }]}>
        {savedHours ? `Times follow ${savedHours.timezone}. A season date is the day and month` : " "}
      </Text>
      <TextField label="Hall name" value={fields.hallName} onChangeText={set("hallName")} autoCapitalize="sentences" maxLength={160} />
      <TextField label="University" value={fields.universityName} onChangeText={set("universityName")} autoCapitalize="sentences" maxLength={160} />
      <TextField label="Grace, minutes" value={fields.grace} onChangeText={set("grace")} keyboardType="number-pad" />
      <TextField label="Summer hours start" value={fields.summerStart} onChangeText={set("summerStart")} />
      <TextField label="Summer hours end" value={fields.summerEnd} onChangeText={set("summerEnd")} />
      <TextField label="Winter hours start" value={fields.winterStart} onChangeText={set("winterStart")} />
      <TextField label="Winter hours end" value={fields.winterEnd} onChangeText={set("winterEnd")} />
      <TextField label="Summer begins" value={fields.summerSeason} onChangeText={set("summerSeason")} autoCapitalize="sentences" />
      <TextField label="Winter begins" value={fields.winterSeason} onChangeText={set("winterSeason")} autoCapitalize="sentences" />
      <TextField label="Permission lead, minutes" value={fields.permissionLead} onChangeText={set("permissionLead")} keyboardType="number-pad" />
      <TextField label="Guest stay, days" value={fields.guestMax} onChangeText={set("guestMax")} keyboardType="number-pad" />
      <TextField label="Guest lead, days" value={fields.guestLead} onChangeText={set("guestLead")} keyboardType="number-pad" />
      <TextField label="Scan window, seconds" value={fields.scanWindow} onChangeText={set("scanWindow")} keyboardType="number-pad" />
      <View style={styles.templates}>
        <Text style={[text.label, { color: colors.inkSoft }]}>Late text</Text>
        <Text style={[text.error, { color: colors.inkFaint }]}>{LATE_PLACEHOLDERS.join("  ")}</Text>
        <TextField label="Late message" value={late} onChangeText={(value) => { setLate(value); setError(null); }} multiline />
        <Text style={[text.label, { color: colors.inkSoft }]}>Return text</Text>
        <Text style={[text.error, { color: colors.inkFaint }]}>{RETURN_PLACEHOLDERS.join("  ")}</Text>
        <TextField label="Return message" value={back} onChangeText={(value) => { setBack(value); setError(null); }} multiline />
      </View>
      <HallButton label="Save settings" busy={busy} disabled={!savedHours} onPress={() => void save()} />
      <OfficeError message={error} />
    </OfficeFrame>
  );
}

const styles = StyleSheet.create({
  templates: { gap: 8 },
});
