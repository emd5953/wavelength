import { useState } from "react";
import { Linking, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { GPSModule } from "../src/services/gps";
import {
  Button,
  Copy,
  Label,
  Notice,
  Title,
  Wave,
  color,
} from "../src/design/ui";
export default function LocationRequiredScreen() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try {
      if ((await GPSModule.requestPermission()) === "granted")
        router.replace("/nearby-feed");
      else
        setError(
          "Location is still off. You can enable it in Settings, then return here.",
        );
    } catch {
      setError("Couldn’t check your location. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        padding: 28,
        paddingBottom: 48,
      }}
    >
      <Wave size={80} />
      <Label style={{ marginTop: 36, color: color.coral }}>
        A SENSE OF PLACE
      </Label>
      <Title style={{ marginTop: 16 }}>{"Find the music\naround you."}</Title>
      <Copy style={{ color: color.muted, marginTop: 20, marginBottom: 20 }}>
        Location lets Wavelength find nearby listeners. When you use discovery,
        other listeners can see your exact listening location on the map. Your
        Spotify identity stays hidden until you both connect.
      </Copy>
      <Button
        title="Open location settings"
        icon="map-pin"
        onPress={() =>
          Linking.openSettings().catch(() =>
            setError("Couldn’t open Settings. Open it from your home screen."),
          )
        }
      />
      <Button
        title="Check location access"
        secondary
        busy={busy}
        onPress={retry}
        style={{ marginTop: 12 }}
      />
      {error && <Notice error message={error} />}
    </ScrollView>
  );
}
