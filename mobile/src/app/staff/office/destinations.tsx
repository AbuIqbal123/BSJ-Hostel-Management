import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { ChoiceLine, OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { PagedList } from "@/components/paged-list";
import { TextField } from "@/components/text-field";
import { useKeyedButtonFeedback } from "@/button-feedback";
import {
  canAddFreeTextPlace,
  hiddenFromResidents,
  readPlace,
  readPlaces,
  type OfficePlace,
} from "@/office";
import { useSession } from "@/session";
import { useFilteredPagedList } from "@/use-filtered-paged-list";
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
  const cue = useKeyedButtonFeedback<"preset" | "custom" | "save">();
  const filters = useMemo(() => ({}), []);

  const list = useFilteredPagedList<OfficePlace, Record<string, never>>({
    idOf: (place) => place.id,
    filters,
    filterKey: "all",
    cacheScope: "office-destinations",
    loadPage: useCallback(async () => {
      const reply = await staffRequest("/admin/destinations");
      const next = reply.ok ? readPlaces(reply.data) : null;
      return next
        ? { items: next, total: next.length }
        : { error: replyError(reply) ?? "Destinations didn't load" };
    }, [staffRequest]),
  });

  const create = async (source: "preset" | "custom") => {
    if (cue.held) {
      return;
    }
    const place = name.trim();
    if (place.length < 1 || place.length > 80) {
      setFormError("Enter the place");
      return;
    }
    cue.markBusy(source);
    const reply = await staffRequest("/admin/destinations", { name: place, source });
    if (!reply.ok || !readPlace(reply.data)) {
      setFormError(replyError(reply) ?? "The place didn't save");
      cue.markFailure();
      return;
    }
    setName("");
    setFormError(null);
    cue.markSuccess(source, () => list.load());
  };

  const save = async () => {
    if (cue.held || !editing) {
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
    cue.markBusy("save");
    const reply = await staffRequest(`/admin/destinations/${encodeURIComponent(editing.id)}`, body, "PATCH");
    if (!reply.ok || !readPlace(reply.data)) {
      setFormError(replyError(reply) ?? "The place didn't save");
      cue.markFailure();
      return;
    }
    setFormError(null);
    cue.markSuccess("save", () => {
      setEditing(null);
      list.load();
    });
  };

  const rows = list.rows ?? [];
  const held = cue.held;
  const offerFreeText = canAddFreeTextPlace(rows);

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
              An inactive place stays on this list. Residents only see active places. One free-text
              place (Other) is enough
            </Text>
            <TextField label="Place" value={name} onChangeText={setName} maxLength={80} autoCapitalize="sentences" />
            <HallButton
              label="Add place"
              busy={cue.busy("preset")}
              succeeded={cue.succeeded("preset")}
              disabled={held}
              onPress={() => void create("preset")}
            />
            {offerFreeText ? (
              <HallButton
                label="Add free-text place"
                busy={cue.busy("custom")}
                succeeded={cue.succeeded("custom")}
                disabled={held}
                onPress={() => void create("custom")}
              />
            ) : (
              <Text style={[text.body, { color: colors.inkSoft }]}>
                Free-text place already on the list. Edit that row if you need to rename or retire it
              </Text>
            )}
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
                <HallButton
                  label="Save place"
                  busy={cue.busy("save")}
                  succeeded={cue.succeeded("save")}
                  disabled={held}
                  onPress={() => void save()}
                />
              </View>
            ) : null}
          </View>
        ))}
      </View>
      </PagedList>
    </OfficeFrame>
  );
}
