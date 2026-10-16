import { useCallback, useState } from "react";
import { Redirect, useFocusEffect, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { DenseRow } from "@/components/dense-row";
import { HallButton } from "@/components/hall-button";
import { ChoiceLine, OfficeError, OfficeFrame, replyError } from "@/components/office-frame";
import { TextField } from "@/components/text-field";
import { bounded, readBlock, readBlocks, readRoom, readRooms, type OfficeBlock, type OfficeRoom } from "@/office";
import { useSession } from "@/session";

export default function OfficeBlock() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { staffRequest } = useSession();
  const [block, setBlock] = useState<OfficeBlock | null>(null);
  const [name, setName] = useState("");
  const [floors, setFloors] = useState("");
  const [roomsCount, setRoomsCount] = useState("");
  const [beds, setBeds] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [rooms, setRooms] = useState<OfficeRoom[]>([]);
  const [number, setNumber] = useState("");
  const [editing, setEditing] = useState<OfficeRoom | null>(null);
  const [roomNumber, setRoomNumber] = useState("");
  const [roomBeds, setRoomBeds] = useState("");
  const [roomStatus, setRoomStatus] = useState<"active" | "inactive">("active");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) {
      return;
    }
    void staffRequest("/admin/blocks").then((reply) => {
      const next = reply.ok ? readBlocks(reply.data) : null;
      const found = next?.find((item) => item.id === id) ?? null;
      if (!found) {
        setError(replyError(reply) ?? "This block didn't load");
        return;
      }
      setBlock(found);
      setName(found.name);
      setFloors(found.floors === null ? "" : String(found.floors));
      setRoomsCount(String(found.roomCount));
      setBeds(String(found.bedsPerRoom));
      setStatus(found.status);
    });
    void staffRequest(`/admin/rooms?block_id=${encodeURIComponent(id)}`).then((reply) => {
      const next = reply.ok ? readRooms(reply.data) : null;
      if (!next) {
        setError(replyError(reply) ?? "Rooms didn't load");
        return;
      }
      setRooms(next);
    });
  }, [id, staffRequest]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!id) {
    return <Redirect href="/staff/office/blocks" />;
  }

  const saveBlock = async () => {
    if (busy || !block) {
      return;
    }
    if (name.trim().length < 1 || name.trim().length > 80) {
      setError("Enter the block name");
      return;
    }
    const roomCount = bounded(roomsCount, 1, 500, "Enter the room count", "Room count is from 1 to 500");
    const bedCount = bounded(beds, 1, 6, "Enter the beds per room", "Beds per room is from 1 to 6");
    const countProblem = typeof roomCount === "string" ? roomCount : typeof bedCount === "string" ? bedCount : null;
    if (countProblem) {
      setError(countProblem);
      return;
    }
    let floorCount: number | null = null;
    if (floors.trim()) {
      const parsed = bounded(floors, 1, 20, "Enter the floors", "Floors are from 1 to 20");
      if (typeof parsed === "string") {
        setError(parsed);
        return;
      }
      floorCount = parsed;
    }
    const body: Record<string, unknown> = {};
    if (name.trim() !== block.name) {
      body.name = name.trim();
    }
    if (floorCount !== block.floors) {
      body.floors = floorCount;
    }
    if (roomCount !== block.roomCount) {
      body.room_count = roomCount;
    }
    if (bedCount !== block.bedsPerRoom) {
      body.beds_per_room = bedCount;
    }
    if (status !== block.status) {
      body.status = status;
    }
    if (Object.keys(body).length === 0) {
      return;
    }
    setBusy(true);
    const reply = await staffRequest(`/admin/blocks/${encodeURIComponent(id)}`, body, "PATCH");
    setBusy(false);
    if (!reply.ok || !readBlock(reply.data)) {
      setError(replyError(reply) ?? "The block didn't save");
      return;
    }
    setError(null);
    load();
  };

  const addRoom = async () => {
    if (busy) {
      return;
    }
    const door = number.trim();
    if (door.length < 1 || door.length > 12) {
      setError("Enter the door number");
      return;
    }
    setBusy(true);
    const reply = await staffRequest("/admin/rooms", { block_id: id, number: door });
    setBusy(false);
    if (!reply.ok || !readRoom(reply.data)) {
      setError(replyError(reply) ?? "The room didn't save");
      return;
    }
    setNumber("");
    setError(null);
    load();
  };

  const saveRoom = async () => {
    if (busy || !editing) {
      return;
    }
    const door = roomNumber.trim();
    if (door.length < 1 || door.length > 12) {
      setError("Enter the door number");
      return;
    }
    const bedCount = bounded(roomBeds, 1, 6, "Enter the beds", "Beds are from 1 to 6");
    if (typeof bedCount === "string") {
      setError(bedCount);
      return;
    }
    const body: Record<string, unknown> = {};
    if (door !== editing.number) {
      body.number = door;
    }
    if (bedCount !== editing.bedCount) {
      body.bed_count = bedCount;
    }
    if (roomStatus !== editing.status) {
      body.status = roomStatus;
    }
    if (Object.keys(body).length === 0) {
      setEditing(null);
      return;
    }
    setBusy(true);
    const reply = await staffRequest(`/admin/rooms/${encodeURIComponent(editing.id)}`, body, "PATCH");
    setBusy(false);
    if (!reply.ok || !readRoom(reply.data)) {
      setError(replyError(reply) ?? "The room didn't save");
      return;
    }
    setEditing(null);
    setError(null);
    load();
  };

  return (
    <OfficeFrame title={block?.name ?? "Block"}>
      <TextField label="Name" value={name} onChangeText={setName} maxLength={80} autoCapitalize="sentences" />
      <TextField label="Floors" value={floors} onChangeText={setFloors} keyboardType="number-pad" />
      <TextField label="Rooms" value={roomsCount} onChangeText={setRoomsCount} keyboardType="number-pad" />
      <TextField label="Beds per room" value={beds} onChangeText={setBeds} keyboardType="number-pad" />
      <ChoiceLine
        label="Block"
        value={status}
        options={[
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ]}
        onChange={(value) => setStatus(value === "inactive" ? "inactive" : "active")}
      />
      <HallButton label="Save block" disabled={busy || !block} onPress={() => void saveBlock()} />
      <TextField label="Door number" value={number} onChangeText={setNumber} maxLength={12} />
      <HallButton label="Add room" disabled={busy} onPress={() => void addRoom()} />
      <OfficeError message={error} />
      <View>
        {rooms.map((room, index, all) => (
          <View key={room.id}>
            <DenseRow
              title={room.label}
              detail={room.number === room.label ? `${room.bedCount} beds` : `Door ${room.number} · ${room.bedCount} beds`}
              time={room.status === "active" ? "Active" : "Inactive"}
              first={index === 0}
              last={index === all.length - 1 && editing?.id !== room.id}
              onPress={() => {
                setEditing(room);
                setRoomNumber(room.number);
                setRoomBeds(String(room.bedCount));
                setRoomStatus(room.status);
                setError(null);
              }}
            />
            {editing?.id === room.id ? (
              <View style={{ gap: 12, paddingVertical: 12 }}>
                <TextField label="Door number" value={roomNumber} onChangeText={setRoomNumber} maxLength={12} />
                <TextField label="Beds" value={roomBeds} onChangeText={setRoomBeds} keyboardType="number-pad" />
                <ChoiceLine
                  label="Room"
                  value={roomStatus}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                  onChange={(value) => setRoomStatus(value === "inactive" ? "inactive" : "active")}
                />
                <HallButton label="Save room" disabled={busy} onPress={() => void saveRoom()} />
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </OfficeFrame>
  );
}
