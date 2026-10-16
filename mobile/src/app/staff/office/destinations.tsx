import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text, View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { EmptyState, ListError } from "@/components/list-state";
import { ChoiceLine, OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { SkeletonRows } from "@/components/skeleton";
import { TextField } from "@/components/text-field";
import { useDelayedLoading } from "@/use-delayed-loading";
import { hiddenFromResidents, readPlace, readPlaces, type OfficePlace } from "@/office";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function OfficeDestinations() {
  const colors = useHallColors();
  const { staffRequest } = useSession();
  const [places, setPlaces] = useState<OfficePlace[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<OfficePlace | null>(null);
  const [editName, setEditName] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [busy, setBusy] = useState<"preset" | "custom" | "save" | null>(null);

  const load = useCallback(
    (fromPull = false) => {
      if (fromPull) {
        setRefreshing(true);
      }
      void staffRequest("/admin/destinations").then((reply) => {
        if (fromPull) {
          setRefreshing(false);
        }
        const next = reply.ok ? readPlaces(reply.data) : null;
        if (!next) {
          setListError(replyError(reply) ?? "Destinations didn't load");
          return;
        }
        setPlaces(next);
        setListError(null);
      });
    },
    [staffRequest],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
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
    load();
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
    load();
  };

  const rows = places ?? [];
  const held = busy !== null;
  const showListSkeleton = useDelayedLoading((places === null || refreshing) && listError === null) && listError === null;

  return (
    <OfficeFrame title="Destinations" refreshing={refreshing} onRefresh={() => load(true)}>
      <Text style={[text.body, { color: colors.inkSoft }]}>
        An inactive place stays on this list. Residents only see active places
      </Text>
      <TextField label="Place" value={name} onChangeText={setName} maxLength={80} autoCapitalize="sentences" />
      <HallButton label="Add place" busy={busy === "preset"} disabled={held} onPress={() => void create("preset")} />
      <HallButton label="Add free-text place" busy={busy === "custom"} disabled={held} onPress={() => void create("custom")} />
      <OfficeError message={formError} />
      {showListSkeleton ? <SkeletonRows count={4} kind="row" /> : null}
      {listError && rows.length === 0 ? <ListError message={listError} onRetry={() => load()} /> : null}
      {listError && rows.length > 0 ? <ListError message={listError} onRetry={() => load(true)} /> : null}
      <View>
        {(showListSkeleton ? [] : rows).map((place, index, all) => (
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
      {!showListSkeleton && places && rows.length === 0 && !listError ? (
        <EmptyState message="No places yet. Add one with the form above." />
      ) : null}
    </OfficeFrame>
  );
}
