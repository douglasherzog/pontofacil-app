import { StatusBar } from "expo-status-bar";
import { BarCodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import * as LocalAuthentication from "expo-local-authentication";
import * as Location from "expo-location";
import * as Random from "expo-random";
import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8011";

const STORE_KEYS = {
  token: "pf_token",
  deviceId: "pf_device_id",
  deviceSecret: "pf_device_secret",
} as const;

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

type TokenResponse = {
  access_token: string;
  token_type?: string;
};

type PairDeviceResponse = {
  device_secret: string;
  employee_user_id: number;
};

type PontoOut = {
  id: number;
  tipo: "entrada" | "saida" | "intervalo_inicio" | "intervalo_fim";
  registrado_em: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  distancia_m: number | null;
};

async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string; deviceId?: string } = {}
): Promise<ApiResult<T>> {
  const url = new URL(path, API_BASE_URL).toString();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.deviceId) headers.set("X-Device-Id", options.deviceId);

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    return { ok: false, error: `Falha ao conectar na API (${API_BASE_URL}).` };
  }

  const text = await res.text();
  const json = text ? safeJsonParse(text) : undefined;

  if (!res.ok) {
    const detail = typeof json === "object" && json && "detail" in (json as any) ? (json as any).detail : undefined;
    const message = typeof detail === "string" ? detail : "Erro ao comunicar com a API";
    return { ok: false, error: message, status: res.status };
  }

  return { ok: true, data: (json as T) ?? (undefined as T) };
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

async function ensureDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(STORE_KEYS.deviceId);
  if (existing) return existing;
  const bytes = Random.getRandomBytes(16);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const id = `pf-${hex}`;
  await SecureStore.setItemAsync(STORE_KEYS.deviceId, id);
  return id;
}

function PrimaryButton(props: { title: string; onPress: () => void | Promise<void>; disabled?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [styles.primaryButton, props.disabled ? styles.primaryButtonDisabled : null, pressed ? styles.primaryButtonPressed : null]}
    >
      <Text style={styles.primaryButtonText}>{props.title}</Text>
    </Pressable>
  );
}

function SecondaryButton(props: { title: string; onPress: () => void | Promise<void>; disabled?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [styles.secondaryButton, props.disabled ? styles.secondaryButtonDisabled : null, pressed ? styles.secondaryButtonPressed : null]}
    >
      <Text style={styles.secondaryButtonText}>{props.title}</Text>
    </Pressable>
  );
}

type Screen = "loading" | "pair" | "login" | "home" | "scan";

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceSecret, setDeviceSecret] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [busy, setBusy] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  const canUseFaceLogin = useMemo(() => !!deviceId && !!deviceSecret, [deviceId, deviceSecret]);

  useEffect(() => {
    (async () => {
      const id = await ensureDeviceId();
      setDeviceId(id);
      const secret = await SecureStore.getItemAsync(STORE_KEYS.deviceSecret);
      setDeviceSecret(secret);
      const savedToken = await SecureStore.getItemAsync(STORE_KEYS.token);
      setToken(savedToken);
      setScreen(savedToken ? "home" : secret ? "login" : "pair");
    })().catch(() => {
      setScreen("pair");
    });
  }, []);

  async function doPair(code: string) {
    if (!deviceId) return;
    setBusy(true);
    try {
      const res = await apiRequest<PairDeviceResponse>("/pair-device", {
        method: "POST",
        body: JSON.stringify({ code, device_id: deviceId, device_name: "Mobile" }),
      });
      if (!res.ok) {
        Alert.alert("Pareamento", res.error);
        return;
      }
      await SecureStore.setItemAsync(STORE_KEYS.deviceSecret, res.data.device_secret);
      setDeviceSecret(res.data.device_secret);
      Alert.alert("Pareamento", "Celular cadastrado com sucesso. Agora você pode fazer login.");
      setScreen("login");
    } finally {
      setBusy(false);
    }
  }

  async function doPasswordLogin() {
    setBusy(true);
    try {
      const res = await apiRequest<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        Alert.alert("Login", res.error);
        return;
      }
      await SecureStore.setItemAsync(STORE_KEYS.token, res.data.access_token);
      setToken(res.data.access_token);
      setScreen("home");
    } finally {
      setBusy(false);
    }
  }

  async function doFaceLogin() {
    if (!deviceId || !deviceSecret) return;
    setBusy(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        Alert.alert("Biometria", "Biometria não disponível neste aparelho.");
        return;
      }

      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirme sua identidade",
        cancelLabel: "Cancelar",
      });
      if (!auth.success) return;

      const res = await apiRequest<TokenResponse>("/auth/device-login", {
        method: "POST",
        body: JSON.stringify({ device_id: deviceId, device_secret: deviceSecret }),
      });
      if (!res.ok) {
        Alert.alert("Login", res.error);
        return;
      }
      await SecureStore.setItemAsync(STORE_KEYS.token, res.data.access_token);
      setToken(res.data.access_token);
      setScreen("home");
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    await SecureStore.deleteItemAsync(STORE_KEYS.token);
    setToken(null);
    setScreen(deviceSecret ? "login" : "pair");
  }

  async function doPunchAuto() {
    if (!token || !deviceId) return;
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Localização", "Permissão de localização negada.");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });

      const res = await apiRequest<PontoOut>("/pontos/auto", {
        method: "POST",
        token,
        deviceId,
        body: JSON.stringify({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy_m: loc.coords.accuracy ?? null,
        }),
      });

      if (!res.ok) {
        Alert.alert("Bater ponto", res.error);
        return;
      }

      Alert.alert("Bater ponto", `OK: ${res.data.tipo.toUpperCase()} (${res.data.registrado_em})`);
    } finally {
      setBusy(false);
    }
  }

  function onBarcodeScanned(result: BarCodeScanningResult) {
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    const raw = (result.data ?? "").trim();
    if (!raw) {
      scanLockRef.current = false;
      return;
    }

    setScreen("pair");
    setPairCode(raw);
    void doPair(raw).finally(() => {
      scanLockRef.current = false;
    });
  }

  if (screen === "loading") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>PontoFácil</Text>
          <View style={styles.rowCenter}>
            <ActivityIndicator />
            <Text style={styles.muted}>Carregando...</Text>
          </View>
        </View>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  if (screen === "scan") {
    if (!permission) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Ler QR Code</Text>
            <Text style={styles.muted}>Carregando permissões de câmera...</Text>
          </View>
        </SafeAreaView>
      );
    }
    if (!permission.granted) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Ler QR Code</Text>
            <Text style={styles.muted}>Precisamos de acesso à câmera.</Text>
            <View style={styles.spacer} />
            <PrimaryButton title="Permitir câmera" onPress={() => requestPermission()} disabled={busy} />
            <View style={styles.spacerSm} />
            <SecondaryButton title="Voltar" onPress={() => setScreen("pair")} disabled={busy} />
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Aponte para o QR</Text>
          <Text style={styles.muted}>O QR code é gerado pelo administrador no painel.</Text>
          <View style={styles.spacer} />
          <View style={styles.cameraBox}>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={onBarcodeScanned}
            />
          </View>
          <View style={styles.spacer} />
          <SecondaryButton title="Cancelar" onPress={() => setScreen("pair")} disabled={busy} />
        </View>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  if (screen === "pair") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Parear celular</Text>
          <Text style={styles.muted}>Leia o QR code fornecido pelo administrador ou cole o código abaixo.</Text>

          <View style={styles.spacer} />

          <Text style={styles.label}>Código (QR)</Text>
          <TextInput
            value={pairCode}
            onChangeText={setPairCode}
            placeholder="Cole o código"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <View style={styles.spacerSm} />
          <PrimaryButton title={busy ? "Aguarde..." : "Parear"} onPress={() => doPair(pairCode.trim())} disabled={busy || !pairCode.trim()} />
          <View style={styles.spacerSm} />
          <SecondaryButton title="Ler QR pela câmera" onPress={() => setScreen("scan")} disabled={busy} />

          <View style={styles.spacer} />
          <Text style={styles.small}>Device ID: {deviceId ?? "-"}</Text>
        </View>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  if (screen === "login") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Entrar</Text>
          <Text style={styles.muted}>Use senha (se permitido) ou reconhecimento facial pelo celular cadastrado.</Text>

          <View style={styles.spacer} />

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />

          <View style={styles.spacerSm} />
          <Text style={styles.label}>Senha</Text>
          <TextInput value={password} onChangeText={setPassword} placeholder="********" secureTextEntry style={styles.input} />

          <View style={styles.spacerSm} />
          <PrimaryButton title={busy ? "Aguarde..." : "Entrar com senha"} onPress={doPasswordLogin} disabled={busy || !email || !password} />

          <View style={styles.spacerSm} />
          <SecondaryButton title={busy ? "Aguarde..." : "Entrar com Face"} onPress={doFaceLogin} disabled={busy || !canUseFaceLogin} />

          <View style={styles.spacer} />
          <SecondaryButton
            title="Re-parear celular"
            onPress={async () => {
              await SecureStore.deleteItemAsync(STORE_KEYS.deviceSecret);
              setDeviceSecret(null);
              setToken(null);
              await SecureStore.deleteItemAsync(STORE_KEYS.token);
              setScreen("pair");
            }}
            disabled={busy}
          />

          {!canUseFaceLogin ? <Text style={styles.small}>Reconhecimento facial só fica disponível após parear o celular.</Text> : null}
        </View>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Bater ponto</Text>
        <Text style={styles.muted}>Você está logado. O registro é validado por localização e pelo celular cadastrado.</Text>
        <View style={styles.spacer} />
        <PrimaryButton title={busy ? "Aguarde..." : "Bater ponto agora"} onPress={doPunchAuto} disabled={busy || !token} />
        <View style={styles.spacerSm} />
        <SecondaryButton title="Sair" onPress={doLogout} disabled={busy} />
        <View style={styles.spacer} />
        <Text style={styles.small}>Device ID: {deviceId ?? "-"}</Text>
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0b1220",
  },
  muted: {
    marginTop: 6,
    fontSize: 13,
    color: "#5b6475",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1f2a44",
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e8ee",
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#0b1220",
    backgroundColor: "#fbfcff",
  },
  primaryButton: {
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4f46e5",
  },
  primaryButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  secondaryButton: {
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e6e8ee",
    backgroundColor: "#ffffff",
  },
  secondaryButtonText: {
    color: "#1f2a44",
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonPressed: {
    backgroundColor: "#f6f7fb",
  },
  spacer: {
    height: 16,
  },
  spacerSm: {
    height: 10,
  },
  small: {
    marginTop: 8,
    fontSize: 11,
    color: "#6b7280",
  },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  cameraBox: {
    height: 260,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0b1220",
  },
});
