import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text, View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { ChoiceLine, OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { TextField } from "@/components/text-field";
import { hiddenFromResidents, readPlace, readPlaces, type OfficePlace } from "@/office";
import { useSession } from "@/session";
import { useHallColors } from "@/theme/colors";
import { text } from "@/theme/text";

export default function OfficeDestinations() {
  const colors = useHallColors();
  const { staffRequest } = useSession();
  const [places, setPlaces] = useState<OfficePlace[] | null>(null);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<OfficePlace | null>(null);
  const [editName, setEditName] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void staffRequest("/admin/destinations").then((reply) => {
      const next = reply.ok ? readPlaces(reply.data) : null;
      if (!next) {
        setError(replyError(reply) ?? "Destinations didn't load");
        return;
      }
      setPlaces(next);
    });
  }, [staffRequest]);

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
      setError("Enter the place");
      return;
    }
    setBusy(true);
    const reply = await staffRequest("/admin/destinations", { name: place, source });
    setBusy(false);
    if (!reply.ok || !readPlace(reply.data)) {
      setError(replyError(reply) ?? "The place didn't save");
      return;
    }
    setName("");
    setError(null);
    load();
  };

  const save = async () => {
    if (busy || !editing) {
      return;
    }
    const place = editName.trim();
    if (place.length < 1 || place.length > 80) {
      setError("Enter the place");
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
    setBusy(true);
    const reply = await staffRequest(`/admin/destinations/${encodeURIComponent(editing.id)}`, body, "PATCH");
    setBusy(false);
    if (!reply.ok || !readPlace(reply.data)) {
      setError(replyError(reply) ?? "The place didn't save");
      return;
    }
    setEditing(null);
    setError(null);
    load();
  };

  return (
    <OfficeFrame title="Destinations">
      <Text style={[text.body, { color: colors.inkSoft }]}>
        An inactive place stays on this list. Residents only see active places
      </Text>
      <TextField label="Place" value={name} onChangeText={setName} maxLength={80} autoCapitalize="sentences" />
      <HallButton label="Add place" disabled={busy} onPress={() => void create("preset")} />
      <HallButton label="Add free-text place" disabled={busy} onPress={() => void create("custom")} />
      <OfficeError message={error} />
      <View>
        {(places ?? []).map((place, index, all) => (
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
                setError(null);
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
                <HallButton label="Save place" disabled={busy} onPress={() => void save()} />
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </OfficeFrame>
  );
}
