# Online Battle System Proposal

## 1. Overview
A lightweight, real-time, and completely free online battle system using **P2P (Peer-to-Peer)** technology.
By connecting players directly to each other, we achieve minimal latency and zero server costs for gameplay.

## 2. Technical Architecture
### **Technology Stack**
*   **WebRTC (via PeerJS)**:
    *   **Why?**: Browser-native real-time communication. Fastest possible connection (direct device-to-device).
    *   **Cost**: **$0**. Valid for "Completely Free".
    *   **Signaling**: PeerJS provides a free public cloud for initial connection handshakes. No backend code required.

### **Connection Flow (Lobby)**
1.  **Host**: Selects "Create Room". Generates a random **Room ID** (Peer ID).
2.  **Guest**: Selects "Join Room". Enters the **Room ID**.
3.  **Check**: Connection established directly. Battle starts.

## 3. Gameplay Synchronization (Sync Strategy)
To ensure responsiveness without lag ("Real-time"):

*   **Optimistic UI**:
    *   Your actions (writing Kanji) happen immediately on your screen.
    *   Results (Damage) are sent to the opponent.
*   **Event-Driven Data**:
    *   Instead of sending "Position X, Y" every frame (heavy), we send **Events**:
        *   `START_WRITING`: Show "Opponent is writing..." indicator.
        *   `COMPLETE_WRITING`: Show attack animation.
        *   `DAMAGE_DEALT`: Sync HP.
        *   `EMOTE`: (Optional) Send emojis.

### **Latency Handling**
*   Since this is a turn-based/active-time battle (not a shooter), slight network jitter (100-200ms) is acceptable.
*   WebRTC usually offers < 50ms latency (faster than standard HTTP servers).

## 4. Implementation Plan (Safety First)
To strictly follow "No impact on existing development":

1.  **Isolated Directory**:
    *   Create `src/features/online/`
    *   All online logic will reside here.
2.  **Separate Scene**:
    *   `OnlineBattleScene.tsx`: A distinct component from the main `BattleScene.tsx`.
    *   It will reuse UI components (`KanjiWriter`, `MonsterDisplay`) but have its own logic engine.
3.  **Feature Flag**:
    *   Accessible only via a hidden button or "Debug Mode" initially, or a new "Online" button in the main menu.

## 5. UI/UX Idea
*   **Simple Lobby**:
    *   [ Create Room ] -> Shows "ID: `fire-dragon-99`"
    *   [ Join Room ] -> Input Box
*   **Battle UI**:
    *   Uses existing Battle UI.
    *   Replaces "Enemy AI" with "Opponent Player Data".

## 6. Next Steps
1.  Install `peerjs`.
2.  Create `src/features/online/NetworkManager.ts` (Singleton to handle P2P).
3.  Create a simple "Connection Test" screen to verify devices can talk to each other.
