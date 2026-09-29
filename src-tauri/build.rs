// build.rs — Tauri build + Deception Matrix Generator
//
// Every compilation:
//  1. Shuffles 15 hard-to-read language layers randomly
//  2. Picks a random phrase from each language's byte pool
//  3. Assigns a unique XOR key (30-229) per layer
//  4. Emits decoy_matrix.rs into OUT_DIR for inclusion by lib.rs
//
// Result: every build has a DIFFERENT binary fingerprint.
// Hackers find 15 fake secrets in unreadable exotic scripts.

use std::time::{SystemTime, UNIX_EPOCH};

fn main() {
  tauri_build::build();
  generate_decoy_matrix();
}

// Minimal LCG PRNG — no external crate needed in build script
struct Lcg(u64);
impl Lcg {
  fn new(seed: u64) -> Self {
    Self(seed ^ 0x9E37_79B9_7F4A_7C15)
  }
  fn next(&mut self) -> u64 {
    self.0 = self
      .0
      .wrapping_mul(6_364_136_223_846_793_005)
      .wrapping_add(1_442_695_040_888_963_407);
    self.0
  }
  fn range(&mut self, lo: u64, hi: u64) -> u64 {
    lo + self.next() % (hi - lo)
  }
  fn pick_idx(&mut self, len: usize) -> usize {
    self.next() as usize % len
  }
}

// ── 15 language pools stored as raw UTF-8 byte sequences ──────────
// Using byte arrays avoids any source-level Unicode escape issues.
// Each sub-array is one phrase (authentic security-related words).
//
// Languages: Mongolian, Tibetan, Myanmar, Georgian, Armenian,
//            Arabic, Hebrew, Sinhala, Khmer, Lao, Thai, Tamil,
//            Ethiopic, Devanagari, Cherokee

// Mongolian Traditional: "ᠮᠣᠩᠭᠣᠯ ᠤᠨ ᠨᠢᠭᠤᠴᠠ" (Mongolian secret)
const MN_0: &[u8] = b"\xe1\xa0\xae\xe1\xa0\xa3\xe1\xa0\xa9\xe1\xa0\xad\xe1\xa0\xa3\xe1\xa0\xaf \xe1\xa0\xa4\xe1\xa0\xa8 \xe1\xa0\xa8\xe1\xa0\xa2\xe1\xa0\xad\xe1\xa0\xa4\xe1\xa0\xb4\xe1\xa0\xa0";
// Mongolian: "ᠯᠢᠴᠧᠨᠰᠡ ᠺᠣᠳ" (license code)
const MN_1: &[u8] = b"\xe1\xa0\xaf\xe1\xa0\xa2\xe1\xa0\xb4\xe1\xa0\xa7\xe1\xa0\xa8\xe1\xa0\xb0\xe1\xa0\xa1 \xe1\xa0\xba\xe1\xa0\xa3\xe1\xa0\xb3";

// Tibetan: "གསང་རྟགས་ཀྱི་ལྡེ་མིག" (secret key)
const BO_0: &[u8] = b"\xe0\xbd\xa2\xe0\xbd\xa6\xe0\xbd\xa0\xe0\xbc\x8b\xe0\xbd\xa2\xe0\xbf\x9f\xe0\xbd\xa2\xe0\xbd\xa6\xe0\xbc\x8b\xe0\xbd\x80\xe0\xbf\xb1\xe0\xbd\xb2\xe0\xbc\x8b\xe0\xbd\xa3\xe0\xbf\xa1\xe0\xbd\xba\xe0\xbc\x8b\xe0\xbd\x98\xe0\xbd\xb2\xe0\xbd\xa2";
// Tibetan: "བོད་ཡིག་ཐུམ་སྒྲིལ" (Tibetan bundle)
const BO_1: &[u8] = b"\xe0\xbd\xa6\xe0\xbd\x86\xe0\xbd\x91\xe0\xbc\x8b\xe0\xbd\xa1\xe0\xbd\xb2\xe0\xbd\xa2\xe0\xbc\x8b\xe0\xbd\x90\xe0\xbd\xb4\xe0\xbd\x98\xe0\xbc\x8b\xe0\xbd\xa6\xe0\xbf\x92\xe0\xbd\xb2\xe0\xbd\xa3";

// Myanmar: "လိုင်စင်ကုဒ်နံပါတ်" (license code)
const MY_0: &[u8] = b"\xe1\x80\xbc\xe1\x80\xad\xe1\x80\xaf\xe1\x80\x84\xe1\x80\xba\xe1\x80\x85\xe1\x80\x84\xe1\x80\xba\xe1\x80\x80\xe1\x80\xaf\xe1\x80\x92\xe1\x80\xba\xe1\x80\x94\xe1\x80\xb6\xe1\x80\x95\xe1\x80\xb9\xe1\x80\xba";
// Myanmar: "လျှို့ဝှက်သော့ချက်" (secret key)
const MY_1: &[u8] = b"\xe1\x80\xbc\xe1\x80\xbb\xe1\x80\xbe\xe1\x80\xad\xe1\x80\x9d\xe1\x80\xbe\xe1\x80\x80\xe1\x80\xba\xe1\x80\x99\xe1\x80\xbe\xe1\x80\xb1\xe1\x80\xba";

// Georgian: "ლიცენზიის გასაღები" (license key)
const KA_0: &[u8] = "ლიცენზიის გასაღები".as_bytes();
// Georgian: "ციფრული ხელმოწერა" (digital signature)
const KA_1: &[u8] = "ციფრული ხელმოწერა".as_bytes();

// Armenian: "արտոնագրի բանալի" (license key)
const HY_0: &[u8] = "արտոնագրի բանալի".as_bytes();
// Armenian: "հաստատման ծածկանշ" (confirmation code)
const HY_1: &[u8] = "հաստատման ծածկանշ".as_bytes();

// Arabic: "مفتاح الترخيص السري" (secret license key)
const AR_0: &[u8] = "مفتاح الترخيص السري".as_bytes();
// Arabic: "التوقيع الرقمي" (digital signature)
const AR_1: &[u8] = "التوقيع الرقمي".as_bytes();

// Hebrew: "מפתח רישיון מוצפן" (encrypted license key)
const HE_0: &[u8] = "מפתח רישיון מוצפן".as_bytes();
// Hebrew: "חתימה אלקטרונית" (electronic signature)
const HE_1: &[u8] = "חתימה אלקטרונית".as_bytes();

// Khmer: "អាជ្ញាប័ណ្ណ លេខកូដ" (license code)
const KM_0: &[u8] = "អាជ្ញាប័ណ្ណ លេខកូដ".as_bytes();
// Khmer: "ការផ្ទៀងផ្ទាត់ ឌីជីថល" (digital verification)
const KM_1: &[u8] = "ការផ្ទៀងផ្ទាត់ ឌីជីថល".as_bytes();

// Lao: "ລະຫັດໃບອະນຸຍາດ" (license code)
const LO_0: &[u8] = "ລະຫັດໃບອະນຸຍາດ".as_bytes();
// Lao: "ລາຍເຊັນດິຈິຕອນ" (digital signature)
const LO_1: &[u8] = "ລາຍເຊັນດິຈິຕອນ".as_bytes();

// Thai: "รหัสลิขสิทธิ์ลับ" (secret copyright code)
const TH_0: &[u8] = "รหัสลิขสิทธิ์ลับ".as_bytes();
// Thai: "การตรวจสอบดิจิทัล" (digital verification)
const TH_1: &[u8] = "การตรวจสอบดิจิทัล".as_bytes();

// Tamil: "உரிம இரகசிய குறியீடு" (secret license code)
const TA_0: &[u8] = "உரிம இரகசிய குறியீடு".as_bytes();
// Tamil: "சாதன அடையாளம்" (device identity)
const TA_1: &[u8] = "சாதன அடையாளம்".as_bytes();

// Ethiopic: "ፈቃድ ሚስጥራዊ ቁልፍ" (secret license key)
const ET_0: &[u8] = "ፈቃድ ሚስጥራዊ ቁልፍ".as_bytes();
// Ethiopic: "ዲጂታል ማረጋገጫ" (digital verification)
const ET_1: &[u8] = "ዲጂታል ማረጋገጫ".as_bytes();

// Devanagari: "लाइसेंस गुप्त कुंजी" (secret license key)
const HI_0: &[u8] = "लाइसेंस गुप्त कुंजी".as_bytes();
// Devanagari: "डिजिटल प्रमाणीकरण" (digital authentication)
const HI_1: &[u8] = "डिजिटल प्रमाणीकरण".as_bytes();

// Cherokee: "ᎠᏂᏙᎲᏍᎬ ᏂᎨᏒᎾ ᎤᎵᏍᏗ" (authorization secret key)
const CHR_0: &[u8] = "ᎠᏂᏙᎲᏍᎬ ᏂᎨᏒᎾ ᎤᎵᏍᏗ".as_bytes();
// Cherokee: "ᏗᏓᎴᏂᏍᏗ ᏣᎳᎩᎯ" (authorized device)
const CHR_1: &[u8] = "ᏗᏓᎴᏂᏍᏗ ᏣᎳᎩᎯ".as_bytes();

// Language pool: (name, [phrase_bytes_a, phrase_bytes_b])
const LANG_POOL: &[(&str, &[&[u8]])] = &[
  ("Mongolian Traditional", &[MN_0, MN_1]),
  ("Tibetan", &[BO_0, BO_1]),
  ("Myanmar", &[MY_0, MY_1]),
  ("Georgian", &[KA_0, KA_1]),
  ("Armenian", &[HY_0, HY_1]),
  ("Arabic", &[AR_0, AR_1]),
  ("Hebrew", &[HE_0, HE_1]),
  ("Khmer", &[KM_0, KM_1]),
  ("Lao", &[LO_0, LO_1]),
  ("Thai", &[TH_0, TH_1]),
  ("Tamil", &[TA_0, TA_1]),
  ("Ethiopic", &[ET_0, ET_1]),
  ("Devanagari", &[HI_0, HI_1]),
  ("Cherokee", &[CHR_0, CHR_1]),
  // 15th layer: mixed fake token (random bytes, no specific language)
  (
    "BinaryToken",
    &[
      b"\xDE\xAD\xBE\xEF\xCA\xFE\xBA\xBE",
      b"\xF0\x0D\xC0\xDE\x13\x37\xFE\xED",
    ],
  ),
];

fn generate_decoy_matrix() {
  let seed = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap()
    .as_nanos() as u64;

  let mut rng = Lcg::new(seed);

  // Shuffle language order — different every build
  let mut order: Vec<usize> = (0..LANG_POOL.len()).collect();
  for i in (1..order.len()).rev() {
    let j = rng.next() as usize % (i + 1);
    order.swap(i, j);
  }

  let mut out = String::new();
  out.push_str("// AUTO-GENERATED DECEPTION MATRIX\n");
  out.push_str("// Unique per compilation. Do not edit.\n");
  out.push_str("// Each build: 15 language layers, different shuffle + XOR keys.\n");
  out.push_str("#[allow(dead_code, non_upper_case_globals, clippy::all)]\n");
  out.push_str("pub(crate) mod decoy_matrix {\n\n");

  // Track identifier tuples for activation function
  let mut ids: Vec<(String, String, String)> = Vec::new();

  for (layer, &lang_idx) in order.iter().enumerate() {
    let (lang_name, phrases) = LANG_POOL[lang_idx];

    // Random XOR key (30..229 avoids 0x00 and common ASCII)
    let xor_key = rng.range(30, 229) as u8;

    // Pick one phrase randomly, XOR-encode its bytes
    let phrase_bytes = phrases[rng.pick_idx(phrases.len())];
    let encoded: Vec<String> = phrase_bytes
      .iter()
      .map(|&b| format!("0x{:02X}", b ^ xor_key))
      .collect();

    // Random fake token (16–31 random bytes — looks like a real key blob)
    let token_len = rng.range(16, 32) as usize;
    let fake_token: Vec<String> = (0..token_len)
      .map(|_| format!("0x{:02X}", (rng.next() & 0xFF) as u8))
      .collect();

    let prefix = format!("L{layer:02}");
    let id_script = format!("{prefix}_SCRIPT");
    let id_token = format!("{prefix}_TOKEN");
    let id_key = format!("{prefix}_KEY");

    out.push_str(&format!("    // Layer {layer:02}: {lang_name}\n"));
    out.push_str(&format!(
      "    pub(crate) const {id_script}: &[u8] = &[{}];\n",
      encoded.join(", ")
    ));
    out.push_str(&format!(
      "    pub(crate) const {id_token}: &[u8] = &[{}];\n",
      fake_token.join(", ")
    ));
    out.push_str(&format!(
      "    pub(crate) const {id_key}: u8 = 0x{xor_key:02X};\n\n"
    ));

    ids.push((id_script, id_token, id_key));
  }

  // activate() keeps all 15 layers alive in the binary (no dead-code strip)
  out.push_str("    #[inline(never)]\n");
  out.push_str("    pub(crate) fn activate() {\n");
  out.push_str("        use std::hint::black_box;\n");

  for (id_script, id_token, id_key) in &ids {
    // Build each statement via push_str (no format!() ambiguity with identifiers)
    out.push_str("        let _ = black_box(");
    out.push_str(id_script);
    out.push_str(".iter().fold(0u8, |a, &b| a.wrapping_add(b ^ ");
    out.push_str(id_key);
    out.push_str(")));\n");

    out.push_str("        let _ = black_box(");
    out.push_str(id_token);
    out.push_str(".iter().fold(0u64, |a, &b| a.wrapping_mul(0x1F).wrapping_add(b as u64)));\n");
  }

  out.push_str("    }\n");
  out.push_str("}\n");

  let out_dir = std::env::var("OUT_DIR").unwrap();
  std::fs::write(format!("{out_dir}/decoy_matrix.rs"), out)
    .expect("Failed to write decoy_matrix.rs");
}
