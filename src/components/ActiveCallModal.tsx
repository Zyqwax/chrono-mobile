import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView } from '@livekit/react-native';

import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { ChronoAvatar } from './ChronoAvatar';
import { useChatStore } from '../store/useChatStore';
import { api } from '../services/api';
import { chronoTheme } from '../theme/colors';
import { callKeepService } from '../services/callkeep';
import { liveKitService, type VideoTracksState } from '../services/livekit';
import { notificationService } from '../services/notifications';
import { foregroundServiceManager } from '../services/foregroundService';
import { callSoundService } from '../services/sound';

const { colors } = chronoTheme;

export const ActiveCallModal: React.FC = () => {
  const {
    activeCall,
    currentUser,
    acceptCall,
    declineCall,
    endCall,
    isMuted,
    toggleMute,
    isVideoOn,
    toggleVideo,
  } = useChatStore();

  const [callDuration, setCallDuration] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitServer, setLivekitServer] = useState<string | null>(null);
  const [livekitLoading, setLivekitLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [videoTracks, setVideoTracks] = useState<VideoTracksState>({ local: null, remote: null });

  // Canlı LiveKit video kanallarını dinle
  useEffect(() => {
    const unsub = liveKitService.subscribeTracks((tracks) => {
      setVideoTracks(tracks);
    });
    return unsub;
  }, []);

  // Dalga / Pulse animasyonu
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isMeCaller = activeCall?.caller?.id === currentUser?.id;
  const otherUser = isMeCaller ? activeCall?.callee : activeCall?.caller;
  const isIncoming = !isMeCaller && activeCall?.state === 'ringing';
  const isOutgoing = isMeCaller && activeCall?.state === 'ringing';
  const isActive = activeCall?.state === 'active';

  // CallKeep (CallKit / TelecomManager) dinleyicilerini bağla
  useEffect(() => {
    callKeepService.setup({
      onAnswerCall: (callId) => acceptCall(callId),
      onEndCall: (callId) => {
        const current = useChatStore.getState().activeCall;
        if (current?.callId === callId) {
          if (current.state === 'active') {
            endCall(callId);
          } else if (current.state === 'ringing') {
            declineCall(callId);
          }
        }
      },
    });
  }, []);

  // Bildirim panelindeki canlı arama kartına tıklandığında aramayı tam ekran yap
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'active_call' || data?.type === 'call') {
        setIsMinimized(false);
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Notifee Foreground Service canlı bildirim kartına tıklandığında aramayı tam ekran yap
  useEffect(() => {
    const unsub = foregroundServiceManager.onNotificationPress(() => {
      setIsMinimized(false);
    });
    return unsub;
  }, []);

  // Yeni arama başladığında tam ekran aç
  useEffect(() => {
    if (activeCall) {
      setIsMinimized(false);
    }
  }, [activeCall?.callId]);

  // Sistem araması (CallKeep) senkronizasyonu
  const lastCallIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeCall) {
      lastCallIdRef.current = activeCall.callId;
      const callerName = otherUser?.displayName || otherUser?.username || 'Kullanıcı';

      if (isIncoming && activeCall.state === 'ringing') {
        callKeepService.displayIncomingCall(activeCall.callId, callerName, activeCall.video);
      } else if (isOutgoing && activeCall.state === 'ringing') {
        callKeepService.startOutgoingCall(activeCall.callId, callerName, activeCall.video);
      } else if (isActive) {
        callKeepService.reportConnectedCall(activeCall.callId);
      }
    } else if (lastCallIdRef.current) {
      callKeepService.endCall(lastCallIdRef.current);
      lastCallIdRef.current = null;
      liveKitService.disconnect();
      notificationService.dismissOngoingCallNotification();
    }
  }, [activeCall, isIncoming, isOutgoing, isActive]);

  // Arama ses ve titreşimleri (Giden arama: santral çalma sesi "düüüt...", Gelen arama: telefonun kesintisiz titreşimi ve sistem zil sesi)
  useEffect(() => {
    if (activeCall?.state === 'ringing') {
      if (isOutgoing) {
        callSoundService.startOutgoingRingback();
        return () => {
          callSoundService.stopAll();
        };
      } else if (isIncoming) {
        // Gelen aramada kesintisiz, sürekli titreşim döngüsü çalışır.
        Vibration.vibrate([0, 1000, 800, 1000], true);
        return () => {
          Vibration.cancel();
          callSoundService.stopAll();
        };
      }
    } else {
      callSoundService.stopAll();
      Vibration.cancel();
    }
  }, [activeCall?.state, isIncoming, isOutgoing]);

  // Radar / Halka animasyonu
  useEffect(() => {
    if (activeCall?.state === 'ringing') {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [activeCall?.state]);

  // Arama süresi sayacı, Bildirim Paneli Kartı ve LiveKit bağlantısı
  useEffect(() => {
    let timer: any = null;
    if (isActive && activeCall) {
      setCallDuration(0);
      const otherName = otherUser?.displayName || otherUser?.username || 'Kullanıcı';
      const callStartTime = Date.now();

      // Arama bağlandığında YALNIZCA BİR KEZ ongoing bildirimi planla (Android kronometresi sistem tarafından işletilir)
      notificationService.showOngoingCallNotification(
        otherName,
        activeCall.video,
        activeCall.callId,
        callStartTime,
      );

      // Yalnızca modal içi süre sayacı (artık periyodik bildirim basmaz)
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      // LiveKit token'ını sunucudan çek
      if (activeCall.mediaRoom) {
        setLivekitLoading(true);
        api
          .get(`/livekit/token/${activeCall.mediaRoom}`)
          .then(async (res) => {
            const token = res.data?.token || null;
            const server = res.data?.serverUrl || null;
            setLivekitToken(token);
            setLivekitServer(server);

            // Android için mikrofon ve gerekirse kamera iznini çalışma zamanında doğrula
            if (Platform.OS === 'android') {
              try {
                const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
                if (activeCall.video || isVideoOn) {
                  perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
                }
                await PermissionsAndroid.requestMultiple(perms);
              } catch (permErr) {
                console.warn('Mikrofon/kamera izin uyarısı:', permErr);
              }
            }

            // Gerçek WebRTC LiveKit odasına bağlan
            if (token && server) {
              liveKitService.connect(server, token, !isMuted, activeCall.video || isVideoOn);
            }
          })
          .catch((err) => {
            console.warn('LiveKit token alma hatası:', err?.message);
          })
          .finally(() => {
            setLivekitLoading(false);
          });
      }
    } else {
      setCallDuration(0);
      setLivekitToken(null);
      setLivekitServer(null);
      liveKitService.disconnect();
      notificationService.dismissOngoingCallNotification();
    }

    return () => {
      if (timer) clearInterval(timer);
      notificationService.dismissOngoingCallNotification();
    };
  }, [isActive, activeCall?.mediaRoom]);

  // Görüntülü arama geldiğinde veya başlatıldığında kamerayı otomatik hazırla
  useEffect(() => {
    if (activeCall?.video && !isVideoOn) {
      toggleVideo();
    }
  }, [activeCall?.video]);

  // Uygulama arkaplandan ön plana döndüğünde görüntüyü ve kamerayı canlı tut
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isActive && (activeCall?.video || isVideoOn)) {
        liveKitService.setCameraEnabled(true).catch(console.warn);
      }
    });
    return () => sub.remove();
  }, [isActive, activeCall?.video, isVideoOn]);

  // Mikrofon ve Kamera durumu değiştiğinde LiveKit'e bildir
  useEffect(() => {
    if (isActive) {
      liveKitService.setMicrophoneEnabled(!isMuted);
    }
  }, [isMuted, isActive]);

  useEffect(() => {
    if (isActive) {
      liveKitService.setCameraEnabled(isVideoOn);
    }
  }, [isVideoOn, isActive]);

  // Hoparlör durumu değiştiğinde WebRTC ses çıkışını güncelle (Hoparlör / Ahize)
  useEffect(() => {
    if (isActive) {
      liveKitService.setSpeakerOutput(speakerOn);
    }
  }, [speakerOn, isActive]);

  if (!activeCall) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const otherName =
    otherUser?.displayName || otherUser?.username || 'Kullanıcı';

  if (isMinimized && activeCall) {
    return (
      <SafeAreaView edges={['top']} style={styles.floatingCallBarContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.floatingCallBar}
          onPress={() => setIsMinimized(false)}
          activeOpacity={0.9}
        >
          <View style={styles.floatingBarLeft}>
            <View style={styles.floatingPulseDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.floatingCallerName} numberOfLines={1}>
                {otherName}
              </Text>
              <Text style={styles.floatingDurationText}>
                {isActive ? formatDuration(callDuration) : 'Bağlanıyor...'} • Dokunarak büyütün
              </Text>
            </View>
          </View>

          <View style={styles.floatingBarActions}>
            <TouchableOpacity
              style={[styles.floatingActionBtn, isMuted && styles.floatingActionBtnMuted]}
              onPress={toggleMute}
            >
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={18} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.floatingEndBtn}
              onPress={() => endCall(activeCall.callId)}
            >
              <Ionicons name="call" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isVideoCall = !!(activeCall?.video || isVideoOn || videoTracks.remote);

  return (
    <Modal
      visible={!!activeCall && !isMinimized}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setIsMinimized(true)}
    >
      <View style={styles.container}>
        {/* Canlı Görüntülü Arama: Uzak Kullanıcı Kamerası (Tam Ekran Arka Plan) */}
        {isVideoCall && isActive && videoTracks.remote ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <VideoView
              videoTrack={videoTracks.remote}
              style={StyleSheet.absoluteFill}
              objectFit="cover"
              zOrder={0}
            />
          </View>
        ) : null}

        {/* Video modunda üst & alt karartma tülü */}
        {isVideoCall && isActive && videoTracks.remote ? (
          <View style={styles.videoOverlayGradient} pointerEvents="none" />
        ) : null}

        <SafeAreaView style={styles.safeContent} edges={['top', 'bottom', 'left', 'right']}>
          {/* Üst Başlık Çubuğu */}
          <View style={styles.topHeader}>
            <TouchableOpacity
              style={styles.minimizeBtn}
              onPress={() => setIsMinimized(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {isVideoCall && isActive ? (
              <View style={styles.videoDurationPill}>
                <View style={styles.greenLiveDot} />
                <Text style={styles.videoDurationText}>{formatDuration(callDuration)}</Text>
              </View>
            ) : (
              <View style={styles.callTypePill}>
                <Ionicons
                  name={isVideoCall ? 'videocam-outline' : 'call-outline'}
                  size={15}
                  color="#38BDF8"
                />
                <Text style={styles.callTypeText}>
                  {isVideoCall ? 'Görüntülü arama' : 'Sesli arama'}
                </Text>
              </View>
            )}

            <View style={{ width: 40 }} />
          </View>

          {/* Kendi Kameramızın Canlı Önizlemesi (PiP - Sağ Üstte Yüzen Kart - Ekran 3) */}
          {isVideoCall && isActive && isVideoOn && (
            <View style={styles.pipContainer}>
              {videoTracks.local ? (
                <VideoView
                  videoTrack={videoTracks.local}
                  style={styles.pipVideo}
                  objectFit="cover"
                  mirror={true}
                  zOrder={1}
                />
              ) : (
                <View style={styles.pipPlaceholder}>
                  <Ionicons name="videocam" size={24} color={colors.primaryLight} />
                  <Text style={styles.pipPlaceholderText}>Kamera Açık</Text>
                </View>
              )}
              {/* PiP Kamera Çevirme Butonu */}
              <TouchableOpacity
                style={styles.pipFlipBtn}
                onPress={() => liveKitService.switchCamera()}
                activeOpacity={0.8}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="camera-reverse" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Sesli arama veya uzak kamera henüz yoksa merkez içerik */}
          {(!isVideoCall || !isActive || !videoTracks.remote) && (
            <View style={styles.centerSection}>
              {/* Radar ve Avatar Kapsayıcısı - Tamamen aynı merkez noktasına kilitli */}
              <View style={styles.avatarRadarBox}>
                {/* 1. Dış En Büyük Radar Çemberi (330x330) */}
                <View style={styles.radarRingOuter} />

                {/* 2. Orta Radar Çemberi (234x234, top/left: 48) */}
                <View style={styles.radarRingMid} />

                {/* 3. Tam Merkezdeki Avatar Çemberi & Fotoğrafı (140x140, top/left: 95) */}
                <View style={styles.avatarWrapper}>
                  {/* İç Zemin & Fotoğraf veya Harf */}
                  <View style={styles.avatarDisc}>
                    {otherUser?.avatarUrl ? (
                      <Image source={{ uri: otherUser.avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <Text
                        style={[
                          styles.avatarInitialLetter,
                          { color: isActive ? '#34D399' : '#60A5FA' },
                        ]}
                      >
                        {otherName.trim().charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>

                  {/* Sönük arka plan iz halkası */}
                  <View style={styles.avatarTrackRing} pointerEvents="none" />

                  {/* Renkli Çember Yayı (Çalarken Mavi, Bağlıyken Yeşil) */}
                  <View
                    style={[
                      styles.avatarArcRing,
                      { borderColor: isActive ? '#10B981' : '#2563EB', borderRightColor: 'transparent' },
                    ]}
                    pointerEvents="none"
                  />

                  {/* Çemberin Sağ Boşluğundaki 3 İkonik Chrono Noktası */}
                  <View
                    style={[
                      styles.avatarDotTop,
                      { backgroundColor: isActive ? '#10B981' : '#2563EB' },
                    ]}
                    pointerEvents="none"
                  />
                  <View
                    style={[
                      styles.avatarDotMid,
                      { backgroundColor: isActive ? '#10B981' : '#2563EB' },
                    ]}
                    pointerEvents="none"
                  />
                  <View
                    style={[
                      styles.avatarDotBottom,
                      { backgroundColor: isActive ? '#10B981' : '#2563EB' },
                    ]}
                    pointerEvents="none"
                  />
                </View>
              </View>

              {/* Arayan / Konuşulan Kişi Adı */}
              <Text style={styles.callerName}>{otherName}</Text>

              {/* Durum Göstergesi */}
              <View style={styles.statusRow}>
                {isActive ? (
                  /* Ekran 2: Bağlı Arama Kapsülleri (00:04 ve Bağlantı iyi) */
                  <View style={styles.connectedPillsRow}>
                    {/* Sol Yeşil Süre Kapsülü */}
                    <View style={styles.durationPill}>
                      <View style={styles.greenLiveDot} />
                      <Text style={styles.durationPillText}>
                        {formatDuration(callDuration)}
                      </Text>
                    </View>

                    {/* Sağ Bağlantı Durumu Kapsülü */}
                    <View style={styles.signalPill}>
                      <Ionicons name="cellular" size={13} color="#10B981" />
                      <Text style={styles.signalPillText}>Bağlantı iyi</Text>
                    </View>
                  </View>
                ) : (
                  /* Ekran 1: Çalıyor ••• */
                  <View style={styles.ringingStatusRow}>
                    <Text style={styles.ringingStatusText}>
                      {isIncoming ? 'Gelen arama' : 'Çalıyor'}
                    </Text>
                    <View style={styles.ringingDots}>
                      <View style={styles.ringingDot} />
                      <View style={styles.ringingDot} />
                      <View style={styles.ringingDot} />
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Video açıkken ortadaki boşluk doldurucu */}
          {isVideoCall && isActive && videoTracks.remote && (
            <View style={{ flex: 1 }} />
          )}

          {/* Alt Butonlar */}
          <View style={styles.controlsFooter}>
            {isIncoming ? (
              /* Gelen Arama Kontrolleri: Reddet ve Cevapla */
              <View style={styles.incomingButtonsRow}>
                <View style={styles.voiceControlCol}>
                  <TouchableOpacity
                    style={[styles.largeActionBtn, styles.declineBtn]}
                    onPress={() => declineCall(activeCall.callId)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="call"
                      size={32}
                      color="#FFFFFF"
                      style={{ transform: [{ rotate: '135deg' }] }}
                    />
                  </TouchableOpacity>
                  <Text style={styles.voiceEndBtnLabel}>Reddet</Text>
                </View>

                <View style={styles.voiceControlCol}>
                  <TouchableOpacity
                    style={[styles.largeActionBtn, styles.acceptBtn]}
                    onPress={() => acceptCall(activeCall.callId)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={activeCall.video ? 'videocam' : 'call'}
                      size={32}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                  <Text style={styles.voiceEndBtnLabel}>Cevapla</Text>
                </View>
              </View>
            ) : isVideoCall && isActive ? (
              /* Ekran 3: Görüntülü Arama Alt Kontrol Çubuğu (5 Buton + İsim) */
              <View style={styles.videoControlsWrapper}>
                <Text style={styles.videoCallerName}>{otherName}</Text>
                <View style={styles.videoControlsRow}>
                  {/* Mikrofon */}
                  <TouchableOpacity
                    style={[
                      styles.videoCircleBtn,
                      isMuted ? styles.circleBtnMuted : styles.videoCircleBtnDark,
                    ]}
                    onPress={toggleMute}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isMuted ? 'mic-off' : 'mic'}
                      size={22}
                      color={isMuted ? '#EF4444' : '#FFFFFF'}
                    />
                  </TouchableOpacity>

                  {/* Kamera (Açıkken Beyaz Dolgulu) */}
                  <TouchableOpacity
                    style={[
                      styles.videoCircleBtn,
                      isVideoOn ? styles.circleBtnWhite : styles.videoCircleBtnDark,
                    ]}
                    onPress={toggleVideo}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isVideoOn ? 'videocam' : 'videocam-off-outline'}
                      size={22}
                      color={isVideoOn ? '#000000' : '#FFFFFF'}
                    />
                  </TouchableOpacity>

                  {/* Ön/Arka Kamera Çevir */}
                  <TouchableOpacity
                    style={[styles.videoCircleBtn, styles.videoCircleBtnDark]}
                    onPress={() => liveKitService.switchCamera()}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="camera-reverse-outline" size={22} color="#FFFFFF" />
                  </TouchableOpacity>

                  {/* Hoparlör */}
                  <TouchableOpacity
                    style={[
                      styles.videoCircleBtn,
                      speakerOn ? styles.circleBtnWhite : styles.videoCircleBtnDark,
                    ]}
                    onPress={() => setSpeakerOn(!speakerOn)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={speakerOn ? 'volume-high' : 'volume-high-outline'}
                      size={22}
                      color={speakerOn ? '#000000' : '#FFFFFF'}
                    />
                  </TouchableOpacity>

                  {/* Sonlandır */}
                  <TouchableOpacity
                    style={[styles.videoCircleBtn, styles.videoCircleBtnEnd]}
                    onPress={() => endCall(activeCall.callId)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="call"
                      size={24}
                      color="#FFFFFF"
                      style={{ transform: [{ rotate: '135deg' }] }}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Ekran 1 & 2: Sesli Arama Kontrolleri */
              <View style={styles.voiceCallControlsWrapper}>
                {/* Üst 3 Buton: Mikrofon, Kamera, Hoparlör */}
                <View style={styles.voiceButtonsRow}>
                  {/* Mikrofon (Ekran 2: Açıkken Beyaz Zemin, Siyah İkon) */}
                  <View style={styles.voiceControlCol}>
                    <TouchableOpacity
                      style={[
                        styles.voiceCircleBtn,
                        isActive && !isMuted ? styles.circleBtnWhite : styles.voiceCircleBtnDark,
                        isMuted && styles.circleBtnMuted,
                      ]}
                      onPress={toggleMute}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={
                          isActive && !isMuted
                            ? 'mic'
                            : isMuted
                            ? 'mic-off'
                            : 'mic-outline'
                        }
                        size={28}
                        color={
                          isActive && !isMuted
                            ? '#000000'
                            : isMuted
                            ? '#EF4444'
                            : '#FFFFFF'
                        }
                      />
                    </TouchableOpacity>
                    <Text style={styles.voiceBtnLabel}>Mikrofon</Text>
                  </View>

                  {/* Kamera */}
                  <View style={styles.voiceControlCol}>
                    <TouchableOpacity
                      style={[
                        styles.voiceCircleBtn,
                        isVideoOn ? styles.circleBtnWhite : styles.voiceCircleBtnDark,
                      ]}
                      onPress={toggleVideo}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isVideoOn ? 'videocam' : 'videocam-off-outline'}
                        size={28}
                        color={isVideoOn ? '#000000' : '#FFFFFF'}
                      />
                    </TouchableOpacity>
                    <Text style={styles.voiceBtnLabel}>Kamera</Text>
                  </View>

                  {/* Hoparlör */}
                  <View style={styles.voiceControlCol}>
                    <TouchableOpacity
                      style={[
                        styles.voiceCircleBtn,
                        speakerOn ? styles.circleBtnWhite : styles.voiceCircleBtnDark,
                      ]}
                      onPress={() => setSpeakerOn(!speakerOn)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={speakerOn ? 'volume-high' : 'volume-high-outline'}
                        size={28}
                        color={speakerOn ? '#000000' : '#FFFFFF'}
                      />
                    </TouchableOpacity>
                    <Text style={styles.voiceBtnLabel}>Hoparlör</Text>
                  </View>
                </View>

                {/* Alt Büyük Kırmızı Buton (Ekran 1: İptal / Ekran 2: Sonlandır) */}
                <View style={styles.endBtnCol}>
                  <TouchableOpacity
                    style={styles.largeEndBtn}
                    onPress={() => {
                      if (activeCall.state === 'ringing' && isOutgoing) {
                        declineCall(activeCall.callId);
                      } else {
                        endCall(activeCall.callId);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="call"
                      size={34}
                      color="#FFFFFF"
                      style={{ transform: [{ rotate: '135deg' }] }}
                    />
                  </TouchableOpacity>
                  <Text style={styles.voiceEndBtnLabel}>
                    {isActive ? 'Sonlandır' : 'İptal'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D18', // Derin Chrono Gece Zemin Rengi
  },
  safeContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  videoOverlayGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(9, 13, 24, 0.4)',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  minimizeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141D2D',
    borderWidth: 1,
    borderColor: '#1F2C44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#141D2D',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F2C44',
  },
  callTypeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  videoDurationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#141D2D',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F2C44',
  },
  videoDurationText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pipContainer: {
    position: 'absolute',
    top: 72,
    right: 20,
    width: 104,
    height: 148,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#2563EB',
    backgroundColor: '#121929',
    zIndex: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  pipVideo: {
    width: '100%',
    height: '100%',
  },
  pipPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121929',
    padding: 8,
  },
  pipPlaceholderText: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  pipFlipBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRadarBox: {
    width: 330,
    height: 330,
    position: 'relative',
    alignSelf: 'center',
  },
  radarRingOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 330,
    height: 330,
    borderRadius: 165,
    borderWidth: 1,
    borderColor: '#141E30',
  },
  radarRingMid: {
    position: 'absolute',
    top: 48,
    left: 48,
    width: 234,
    height: 234,
    borderRadius: 117,
    borderWidth: 1,
    borderColor: '#1A273E',
  },
  avatarWrapper: {
    position: 'absolute',
    top: 95,
    left: 95,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  avatarDisc: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#101726',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    resizeMode: 'cover',
  },
  avatarInitialLetter: {
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: -1,
  },
  avatarTrackRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  avatarArcRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
  },
  avatarDotTop: {
    position: 'absolute',
    top: 39,
    left: 130,
    width: 5.5,
    height: 5.5,
    borderRadius: 2.75,
  },
  avatarDotMid: {
    position: 'absolute',
    top: 67,
    left: 136,
    width: 5.5,
    height: 5.5,
    borderRadius: 2.75,
  },
  avatarDotBottom: {
    position: 'absolute',
    top: 95,
    left: 130,
    width: 5.5,
    height: 5.5,
    borderRadius: 2.75,
  },
  callerName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 28,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  statusRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  ringingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ringingStatusText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  ringingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ringingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#38BDF8',
  },
  connectedPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  greenLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  durationPillText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  signalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#131C2D',
    borderWidth: 1,
    borderColor: '#1F2C44',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  signalPillText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '500',
  },
  controlsFooter: {
    paddingBottom: 36,
  },
  incomingButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  voiceControlCol: {
    alignItems: 'center',
    width: 80,
  },
  endBtnCol: {
    alignItems: 'center',
  },
  largeActionBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineBtn: {
    backgroundColor: '#EF4444',
  },
  acceptBtn: {
    backgroundColor: '#10B981',
  },
  voiceBtnLabel: {
    marginTop: 10,
    color: '#7E8BA6',
    fontSize: 13,
    fontWeight: '500',
  },
  voiceEndBtnLabel: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  voiceCallControlsWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  voiceButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  voiceCircleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceCircleBtnDark: {
    backgroundColor: '#141D2D',
    borderWidth: 1,
    borderColor: '#1F2C44',
  },
  circleBtnWhite: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
  },
  circleBtnMuted: {
    backgroundColor: '#1E2536',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  largeEndBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoControlsWrapper: {
    gap: 16,
  },
  videoCallerName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: 12,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  videoControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  videoCircleBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCircleBtnDark: {
    backgroundColor: '#141D2D',
    borderWidth: 1,
    borderColor: '#1F2C44',
  },
  videoCircleBtnEnd: {
    backgroundColor: '#EF4444',
  },
  floatingCallBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  floatingCallBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#151E2B',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#10B981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
  },
  floatingBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  floatingPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  floatingCallerName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  floatingDurationText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  floatingBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatingActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingActionBtnMuted: {
    backgroundColor: colors.error,
  },
  floatingEndBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
  },
});
