import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text, View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { ChoiceLine, OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { PagedList } from "@/components/paged-list";
import { TextField } from "@/components/text-field";
import { hiddenFromResidents, readPlace, readPlaces, type OfficePlace } from "@/office";
import { useSession } from "@/session";
import { useListPage } from "@/use-list-page";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function OfficeDestinations() {
  const colors = useHallColors();
  const { staffRequest } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<OfficePlace | null>(null);
  const [editName, setEditName] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [busy, setBusy] = useState<"preset" | "custom" | "save" | null>(null);

  const list = useListPage<OfficePlace>({
    auto: false,
    idOf: (place) => place.id,
    loadPage: async () => {
      const reply = await staffRequest("/admin/destinations");
      const next = reply.ok ? readPlaces(reply.data) : null;
      return next
        ? { items: next, total: next.length }
        : { error: replyError(reply) ?? "Destinations didn't load" };
    },
  });

  useFocusEffect(
    useCallback(() => {
      list.load();
    }, [list.load]),
  );

  const create = async (source: "preset" | "custom") => {
    if (busy) {
      return;
    }
    const place = name.trim();
    if (place.length < 1 || place.length > 80) {
      setFormError("Enter the place");
      return;
    }
    setBusy(source);
    const reply = await staffRequest("/admin/destinations", { name: place, source });
    setBusy(null);
    if (!reply.ok || !readPlace(reply.data)) {
      setFormError(replyError(reply) ?? "The place didn't save");
      return;
    }
    setName("");
    setFormError(null);
    list.load();
  };

  const save = async () => {
    if (busy || !editing) {
      return;
    }
    const place = editName.trim();
    if (place.length < 1 || place.length > 80) {
      setFormError("Enter the place");
      return;
    }
    const body: Record<string, unknown> = {};
    if (place !== editing.name) {
      body.name = place;
    }
    if (status !== editing.status) {
      body.status = status;
    }
    if (Object.keys(body).length === 0) {
      setEditing(null);
      return;
    }
    setBusy("save");
    const reply = await staffRequest(`/admin/destinations/${encodeURIComponent(editing.id)}`, body, "PATCH");
    setBusy(null);
    if (!reply.ok || !readPlace(reply.data)) {
      setFormError(replyError(reply) ?? "The place didn't save");
      return;
    }
    setEditing(null);
    setFormError(null);
    list.load();
  };

  const rows = list.rows ?? [];
  const held = busy !== null;

  return (
    <OfficeFrame title="Destinations" refreshing={list.refreshing} onRefresh={list.refresh}>
      <PagedList
        rows={list.rows}
        error={list.error}
        pageError={list.pageError}
        showListSkeleton={list.showListSkeleton}
        showPageSkeleton={list.showPageSkeleton}
        onRetry={list.retry}
        onRetryPage={() => list.loadNext(true)}
        empty="No places yet. Add one with the form above."
        header={
          <>
            <Text style={[text.body, { color: colors.inkSoft }]}>
              An inactive place stays on this list. Residents only see active places
            </Text>
            <TextField label="Place" value={name} onChangeText={setName} maxLength={80} autoCapitalize="sentences" />
            <HallButton label="Add place" busy={busy === "preset"} disabled={held} onPress={() => void create("preset")} />
            <HallButton label="Add free-text place" busy={busy === "custom"} disabled={held} onPress={() => void create("custom")} />
            <OfficeError message={formError} />
          </>
        }
      >
      <View>
        {rows.map((place, index, all) => (
          <View key={place.id}>
            <DenseRow
              title={place.name}
              detail={
                hiddenFromResidents(place)
                  ? "Inactive, hidden from residents"
                  : place.source === "custom"
                    ? "Free-text place"
                    : "Named place"
              }
              time={place.status === "active" ? "Active" : "Inactive"}
              first={index === 0}
              last={index === all.length - 1 && editing?.id !== place.id}
              onPress={() => {
                setEditing(place);
                setEditName(place.name);
                setStatus(place.status);
                setFormError(null);
              }}
            />
            {editing?.id === place.id ? (
              <View style={{ gap: 12, paddingVertical: 12 }}>
                <TextField label="Place" value={editName} onChangeText={setEditName} maxLength={80} autoCapitalize="sentences" />
                <ChoiceLine
                  label="Place"
                  value={status}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                  onChange={(value) => setStatus(value === "inactive" ? "inactive" : "active")}
                />
                <HallButton label="Save place" busy={busy === "save"} disabled={held} onPress={() => void save()} />
              </View>
            ) : null}
          </View>
        ))}
      </View>
      </PagedList>
    </OfficeFrame>
  );
}
