import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { TextField } from "@/components/text-field";
import { bounded, readBlock, readBlocks, type OfficeBlock } from "@/office";
import { useSession } from "@/session";

export default function OfficeBlocks() {
  const { staffRequest } = useSession();
  const [blocks, setBlocks] = useState<OfficeBlock[] | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [floors, setFloors] = useState("");
  const [rooms, setRooms] = useState("");
  const [beds, setBeds] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void staffRequest("/admin/blocks").then((reply) => {
      const next = reply.ok ? readBlocks(reply.data) : null;
      if (!next) {
        setError(replyError(reply) ?? "Blocks didn't load");
        return;
      }
      setBlocks(next);
    });
  }, [staffRequest]);

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
      setError("Enter a short code");
      return;
    }
    if (name.trim().length < 1 || name.trim().length > 80) {
      setError("Enter the block name");
      return;
    }
    const roomCount = bounded(rooms, 1, 500, "Enter the room count", "Room count is from 1 to 500");
    const bedCount = bounded(beds, 1, 6, "Enter the beds per room", "Beds per room is from 1 to 6");
    if (typeof roomCount === "string") {
      setError(roomCount);
      return;
    }
    if (typeof bedCount === "string") {
      setError(bedCount);
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
        setError(floorCount);
        return;
      }
      body.floors = floorCount;
    }
    setBusy(true);
    const reply = await staffRequest("/admin/blocks", body);
    const created = reply.ok ? readBlock(reply.data) : null;
    setBusy(false);
    if (!created) {
      setError(replyError(reply) ?? "The block didn't save");
      return;
    }
    setCode("");
    setName("");
    setFloors("");
    setRooms("");
    setBeds("");
    setError(null);
    load();
  };

  return (
    <OfficeFrame title="Blocks and rooms">
      <TextField label="Code" value={code} onChangeText={setCode} maxLength={16} autoCapitalize="sentences" />
      <TextField label="Name" value={name} onChangeText={setName} maxLength={80} autoCapitalize="sentences" />
      <TextField label="Floors" value={floors} onChangeText={setFloors} keyboardType="number-pad" />
      <TextField label="Rooms" value={rooms} onChangeText={setRooms} keyboardType="number-pad" />
      <TextField label="Beds per room" value={beds} onChangeText={setBeds} keyboardType="number-pad" />
      <HallButton label="Add block" disabled={busy} onPress={() => void create()} />
      <OfficeError message={error} />
      <View>
        {(blocks ?? []).map((block, index, all) => (
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
    </OfficeFrame>
  );
}
