import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { PagedList } from "@/components/paged-list";
import { TextField } from "@/components/text-field";
import { bounded, readBlock, readBlocks, type OfficeBlock } from "@/office";
import { useSession } from "@/session";
import { useListPage } from "@/use-list-page";

export default function OfficeBlocks() {
  const { staffRequest } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [floors, setFloors] = useState("");
  const [rooms, setRooms] = useState("");
  const [beds, setBeds] = useState("");
  const [busy, setBusy] = useState(false);

  const list = useListPage<OfficeBlock>({
    auto: false,
    idOf: (block) => block.id,
    loadPage: async () => {
      const reply = await staffRequest("/admin/blocks");
      const next = reply.ok ? readBlocks(reply.data) : null;
      return next ? { items: next, total: next.length } : { error: replyError(reply) ?? "Blocks didn't load" };
    },
  });

  useFocusEffect(
    useCallback(() => {
      list.load();
    }, [list.load]),
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
    list.load();
  };

  const rows = list.rows ?? [];

  return (
    <OfficeFrame title="Blocks and rooms" refreshing={list.refreshing} onRefresh={list.refresh}>
      <PagedList
        rows={list.rows}
        error={list.error}
        pageError={list.pageError}
        showListSkeleton={list.showListSkeleton}
        showPageSkeleton={list.showPageSkeleton}
        onRetry={list.retry}
        onRetryPage={() => list.loadNext(true)}
        empty="No blocks yet. Add one with the form above."
        header={
          <>
            <TextField label="Code" value={code} onChangeText={setCode} maxLength={16} autoCapitalize="sentences" />
            <TextField label="Name" value={name} onChangeText={setName} maxLength={80} autoCapitalize="sentences" />
            <TextField label="Floors" value={floors} onChangeText={setFloors} keyboardType="number-pad" />
            <TextField label="Rooms" value={rooms} onChangeText={setRooms} keyboardType="number-pad" />
            <TextField label="Beds per room" value={beds} onChangeText={setBeds} keyboardType="number-pad" />
            <HallButton label="Add block" busy={busy} onPress={() => void create()} />
            <OfficeError message={formError} />
          </>
        }
      >
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
      </PagedList>
    </OfficeFrame>
  );
}
