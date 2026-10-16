import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { EmptyState, ListError } from "@/components/list-state";
import { OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { SkeletonRows } from "@/components/skeleton";
import { TextField } from "@/components/text-field";
import { bounded, readBlock, readBlocks, type OfficeBlock } from "@/office";
import { useSession } from "@/session";

export default function OfficeBlocks() {
  const { staffRequest } = useSession();
  const [blocks, setBlocks] = useState<OfficeBlock[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [floors, setFloors] = useState("");
  const [rooms, setRooms] = useState("");
  const [beds, setBeds] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    (fromPull = false) => {
      if (fromPull) {
        setRefreshing(true);
      }
      void staffRequest("/admin/blocks").then((reply) => {
        if (fromPull) {
          setRefreshing(false);
        }
        const next = reply.ok ? readBlocks(reply.data) : null;
        if (!next) {
          setListError(replyError(reply) ?? "Blocks didn't load");
          return;
        }
        setBlocks(next);
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

  const create = async () => {
    if (busy) {
      return;
    }
    if (code.trim().length < 1 || code.trim().length > 16) {
      setFormError("Enter a short code");
      return;
    }
    if (name.trim().length < 1 || name.trim().length > 80) {
      setFormError("Enter the block name");
      return;
    }
    const roomCount = bounded(rooms, 1, 500, "Enter the room count", "Room count is from 1 to 500");
    const bedCount = bounded(beds, 1, 6, "Enter the beds per room", "Beds per room is from 1 to 6");
    if (typeof roomCount === "string") {
      setFormError(roomCount);
      return;
    }
    if (typeof bedCount === "string") {
      setFormError(bedCount);
      return;
    }
    const body: Record<string, unknown> = {
      code: code.trim(),
      name: name.trim(),
      room_count: roomCount,
      beds_per_room: bedCount,
    };
    if (floors.trim()) {
      const floorCount = bounded(floors, 1, 20, "Enter the floors", "Floors are from 1 to 20");
      if (typeof floorCount === "string") {
        setFormError(floorCount);
        return;
      }
      body.floors = floorCount;
    }
    setBusy(true);
    const reply = await staffRequest("/admin/blocks", body);
    setBusy(false);
    const created = reply.ok ? readBlock(reply.data) : null;
    if (!created) {
      setFormError(replyError(reply) ?? "The block didn't save");
      return;
    }
    setCode("");
    setName("");
    setFloors("");
    setRooms("");
    setBeds("");
    setFormError(null);
    load();
  };

  const rows = blocks ?? [];

  return (
    <OfficeFrame title="Blocks and rooms" refreshing={refreshing} onRefresh={() => load(true)}>
      <TextField label="Code" value={code} onChangeText={setCode} maxLength={16} autoCapitalize="sentences" />
      <TextField label="Name" value={name} onChangeText={setName} maxLength={80} autoCapitalize="sentences" />
      <TextField label="Floors" value={floors} onChangeText={setFloors} keyboardType="number-pad" />
      <TextField label="Rooms" value={rooms} onChangeText={setRooms} keyboardType="number-pad" />
      <TextField label="Beds per room" value={beds} onChangeText={setBeds} keyboardType="number-pad" />
      <HallButton label="Add block" busy={busy} onPress={() => void create()} />
      <OfficeError message={formError} />
      {blocks === null && !listError ? <SkeletonRows count={4} kind="row" /> : null}
      {listError && rows.length === 0 ? <ListError message={listError} onRetry={() => load()} /> : null}
      {listError && rows.length > 0 ? <ListError message={listError} onRetry={() => load(true)} /> : null}
      <View>
        {rows.map((block, index, all) => (
          <DenseRow
            key={block.id}
            title={block.name}
            detail={`${block.code} · ${block.roomCount} rooms`}
            time={block.status === "active" ? "Active" : "Inactive"}
            first={index === 0}
            last={index === all.length - 1}
            onPress={() => router.push({ pathname: "/staff/office/block", params: { id: block.id } })}
          />
        ))}
      </View>
      {blocks && rows.length === 0 && !listError ? <EmptyState message="No blocks yet. Add one with the form above." /> : null}
    </OfficeFrame>
  );
}
