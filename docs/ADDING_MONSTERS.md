# モンスター追加方法

## 新規モンスターの追加手順

### 1. 画像ファイルの追加

1. 透過PNG画像を用意（推奨サイズ: 512x512px）
2. ファイル名は `snake_case` 形式（例: `blue_ice_dragon.png`）
3. `/public/monsters/` フォルダに配置

### 2. index.json の更新

モンスター画像リストを更新するために、プロジェクトルートで以下のコマンドを実行：

```bash
ls -1 public/monsters/*.png | xargs -I{} basename {} .png | jq -R -s -c 'split("\n") | map(select(length > 0))' > public/monsters/index.json
```

または手動で `/public/monsters/index.json` を編集してIDを追加：

```json
["既存のモンスター", "blue_ice_dragon", "新しいモンスター"]
```

### 3. CSVデータの編集

#### 方法A: デバッグモードで編集（推奨）

1. ゲーム内でデバッグモードを開く
   - **PC**: `Shift + D` を5回連打
   - **スマホ**: 画面右下を3回タップ

2. 「CSVエディタ」タブを選択

3. 適切なCSVファイルを選択：
   - `enemy_data.csv` - 敵として出現するモンスター
   - `evolution_data.csv` - プレイヤーが使用できるモンスター

4. 「➕ 行追加」をクリック

5. IDカラムのドロップダウンから新しいモンスター画像を選択

6. 他のパラメータを入力

7. 「🎮 ゲームに適用」をクリック

#### 方法B: CSVファイルを直接編集

`/src/data/` フォルダ内のCSVファイルを編集：

**enemy_data.csv のカラム:**
| カラム | 説明 | 例 |
|--------|------|-----|
| id | モンスターID（画像名と同じ） | blue_ice_dragon |
| name | 表示名 | アイスドラゴン |
| element | 攻撃属性（FIRE/WATER/NATURE/LIGHT/DARK） | WATER |
| weakness | 弱点属性（FIRE/WATER/NATURE/LIGHT/DARK） | NATURE |
| hp | 基本HP | 100 |
| attack | 基本攻撃力 | 20 |
| expReward | 経験値報酬 | 15 |
| goldReward | ゴールド報酬 | 10 |

**evolution_data.csv のカラム:**
| カラム | 説明 |
|--------|------|
| id | モンスターID |
| name | 表示名 |
| element | 攻撃属性 |
| weakness | 弱点属性 |
| baseHp | 基本HP |
| baseAttack | 基本攻撃力 |
| evolutionConditionType | 進化条件（LEVEL/MASTERY/NONE） |
| evolutionConditionValue | 進化条件値 |
| nextFormId | 進化先ID |
| description | 説明文 |
| unlockText | アンロック条件テキスト |
| unlockCondition | アンロック条件（STARTER/STAGE:N5-1等） |

### 4. ビルドとデプロイ

CSVファイルを直接編集した場合：

```bash
npm run build
npm run deploy  # または npm run deploy:vercel
```

デバッグモードで編集した場合は、変更がLocalStorageに保存されるため即時反映されます。
ただし恒久的な変更には「📤 エクスポート」でCSVをダウンロードし、ソースファイルを置き換えてください。

## 注意事項

- モンスターIDは画像ファイル名（.pngを除く）と完全に一致させる必要があります
- 存在しないIDを使用した場合、その行は無視されます（エラーにはなりません）
- デバッグモードの変更はブラウザのキャッシュクリアで消えます
