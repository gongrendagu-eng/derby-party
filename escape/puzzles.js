/* お題（謎）データ。type: num=数字入力 / text=文字入力 / choice=選択式。
   answers は norm() で正規化した後の文字列と比較する。 */
function norm(s){
  s = String(s == null ? '' : s).normalize('NFKC').toLowerCase();
  s = s.replace(/[\s　・,，.。:：、]/g, '');
  return s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const PUZZLES = [
  { id:'seq1', title:'止まった数列', type:'num',
    body:'黒板にこう書いてある。<br><b>2 ・ 6 ・ 12 ・ 20 ・ 30 ・ ？</b><br>？に入る数は？',
    answers:['42'], hint:'となり合う数の差を見てみよう。4、6、8、10…' },
  { id:'fib', title:'増えていく数', type:'num',
    body:'机の落書き。<br><b>1 ・ 1 ・ 2 ・ 3 ・ 5 ・ 8 ・ ？</b><br>？に入る数は？',
    answers:['13'], hint:'前の2つの数を足すと次の数になる。' },
  { id:'abc', title:'ロッカーの暗号', type:'text',
    body:'ロッカーの扉に数字が並んでいる。<br><b>1 － 3 － 3 － 15 － 21 － 14 － 20 － 9 － 14 － 7</b><br>A=1、B=2、C=3…と考えて文字に直そう。答えは英単語。',
    answers:['accounting'], hint:'この教室でよく使う言葉。「会計」を英語にすると？' },
  { id:'liar', title:'嘘つきは誰だ', type:'choice',
    body:'犯人は1人だけ。3人のうち、嘘をついているのはちょうど1人。<br>A「犯人はBだ」<br>B「犯人はCだ」<br>C「私は犯人ではない」<br>犯人は誰？',
    options:['A','B','C'], correct:1, hint:'「Aが嘘つき」と仮定して、矛盾しないか順番に確かめよう。' },
  { id:'clock90', title:'時計の針', type:'num',
    body:'壁の時計が<b>3時ちょうど</b>を指している。<br>長針と短針がつくる小さい方の角度は何度？',
    answers:['90'], hint:'時計の文字盤は360度。1時間分は何度？' },
  { id:'riddle', title:'音楽室のなぞなぞ', type:'text',
    body:'ピアノの上に紙が置かれている。<br>「朝は4本足、昼は2本足、夜は3本足。これは何？」',
    answers:['人','人間','にんげん','ひと'], hint:'一生のあいだの姿を、一日にたとえている。' },
  { id:'palin', title:'上から読んでも', type:'text',
    body:'毎朝ポストに届く、紙の束。<br>上から読んでも下から読んでも同じになる5文字の言葉は？（ひらがな、または漢字）',
    answers:['しんぶんし','新聞紙'], hint:'「し・ん・ぶ・ん・し」…。ニュースが載っている。' },
  { id:'magic', title:'崩れた魔方陣', type:'num',
    body:'縦・横・ななめの合計がすべて同じになる魔方陣。<br><b>2 ｜ ？ ｜ 6<br>？ ｜ 5 ｜ 1<br>4 ｜ 3 ｜ ？</b><br>3つの？に入る数をすべて足すといくつ？',
    answers:['24'], hint:'まず、合計がいくつ(縦横ななめ共通)になるかを2・5・8の並び等から決めよう。' },
  { id:'week', title:'日めくりカレンダー', type:'text',
    body:'今日は<b>木曜日</b>。<br>ちょうど<b>100日後</b>は何曜日？',
    answers:['土','土曜','土曜日','どよう','どようび'], hint:'7日で曜日は一周する。100を7で割った余りは？' },
  { id:'tsuru', title:'鳥とうさぎ', type:'num',
    body:'ニワトリとウサギが合わせて<b>10匹</b>。足の合計は<b>28本</b>。<br>ウサギは何匹？',
    answers:['4'], hint:'全部ニワトリだと足は20本。足りない分は？' },
  { id:'square', title:'数えるマス目', type:'num',
    body:'<b>3×3</b>のマス目の中に、正方形は全部でいくつ見つかる？（大きさは問わない）',
    answers:['14'], hint:'1×1が9個。2×2と3×3はいくつ？' },
  { id:'shift', title:'ずれた文字', type:'text',
    body:'黒板にこんな暗号。<br><b>きうこう</b><br>これは、元の言葉の各文字を五十音の順で「1つ後ろ」にずらしたもの。元の言葉は？',
    answers:['かいけい','会計'], hint:'「き」の1つ前は？「う」の1つ前は？' },
  { id:'jwk1', title:'仕訳のかぎ①', type:'choice',
    body:'商品500円を<b>現金で仕入れた</b>。<br>借方に書く勘定科目は？',
    options:['現金','仕入','売上','買掛金'], correct:1, hint:'仕入れた商品は費用（仕入）として借方に。' },
  { id:'jwk2', title:'仕訳のかぎ②', type:'choice',
    body:'商品を<b>掛けで仕入れた</b>。<br>貸方に書く勘定科目は？',
    options:['売掛金','買掛金','未払金','仕入'], correct:1, hint:'あとで払う義務（債務）が増えた。' },
  { id:'equity', title:'帳簿の残り', type:'num',
    body:'資産が<b>300円</b>、負債が<b>100円</b>。<br>純資産（資本）はいくら？',
    answers:['200'], hint:'資産＝負債＋純資産。' },
  { id:'digit', title:'2けたの鍵', type:'num',
    body:'2けたの整数が1つある。<br>・十の位と一の位の和は<b>9</b><br>・十の位は一の位より<b>3大きい</b><br>この数は？',
    answers:['63'], hint:'十の位をa、一の位をbとして a+b=9、a−b=3。' },
  { id:'divisor', title:'約数の数', type:'num',
    body:'<b>12</b>の約数は、全部でいくつある？',
    answers:['6'], hint:'1と12、2と6、3と4…' },
  { id:'mirror', title:'鏡の中の時計', type:'text',
    body:'廊下の鏡に、壁の時計が映っている。鏡の中では<b>9時20分</b>を指している。<br>実際の時刻は？（○:○○ の形で答えよう）',
    answers:['240','0240','2時40分'], hint:'鏡では左右が反転する。12時から見た位置を考えよう。' },
  { id:'sum10', title:'階段の数', type:'num',
    body:'階段の段数は、1から10までの整数をすべて足した数。<br>全部で何段？',
    answers:['55'], hint:'1と10、2と9、3と8…のペアを作ろう。' }
];

function checkAnswer(p, input){
  if (p.type === 'choice') return Number(input) === p.correct;
  const v = norm(input);
  if (!v) return false;
  return p.answers.some(a => norm(a) === v);
}
