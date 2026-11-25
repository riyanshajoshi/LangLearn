// Small, curated phrasebook. Each row represents the same basic meaning.
const columns = ['English','Hindi','Kannada','Tamil','Telugu','Malayalam','Bengali','Marathi','Gujarati','Punjabi','French','Spanish','German','Japanese'];
const rows = [
'Hello|नमस्ते|ನಮಸ್ಕಾರ|வணக்கம்|నమస్కారం|നമസ്കാരം|নমস্কার|नमस्कार|નમસ્તે|ਸਤ ਸ੍ਰੀ ਅਕਾਲ|Bonjour|Hola|Hallo|こんにちは',
'Thank you|धन्यवाद|ಧನ್ಯವಾದಗಳು|நன்றி|ధన్యవాదాలు|നന്ദി|ধন্যবাদ|धन्यवाद|આભાર|ਧੰਨਵਾਦ|Merci|Gracias|Danke|ありがとう',
'Yes|हाँ|ಹೌದು|ஆம்|అవును|അതെ|হ্যাঁ|हो|હા|ਹਾਂ|Oui|Sí|Ja|はい',
'No|नहीं|ಇಲ್ಲ|இல்லை|కాదు|അല്ല|না|नाही|ના|ਨਹੀਂ|Non|No|Nein|いいえ',
'Water|पानी|ನೀರು|தண்ணீர்|నీరు|വെള്ളം|জল|पाणी|પાણી|ਪਾਣੀ|Eau|Agua|Wasser|水',
'Book|किताब|ಪುಸ್ತಕ|புத்தகம்|పుస్తకం|പുസ്തകം|বই|पुस्तक|પુસ્તક|ਕਿਤਾਬ|Livre|Libro|Buch|本',
'Friend|दोस्त|ಸ್ನೇಹಿತ|நண்பர்|స్నేహితుడు|സുഹൃത്ത്|বন্ধু|मित्र|મિત્ર|ਦੋਸਤ|Ami|Amigo|Freund|友達',
'Good morning|सुप्रभात|ಶುಭೋದಯ|காலை வணக்கம்|శుభోదయం|സുപ്രഭാതം|সুপ্রভাত|शुभ सकाळ|સુપ્રભાત|ਸ਼ੁਭ ਸਵੇਰ|Bonjour|Buenos días|Guten Morgen|おはようございます',
'Good night|शुभ रात्रि|ಶುಭ ರಾತ್ರಿ|இனிய இரவு|శుభ రాత్రి|ശുഭരാത്രി|শুভ রাত্রি|शुभ रात्री|શુભ રાત્રિ|ਸ਼ੁਭ ਰਾਤ|Bonne nuit|Buenas noches|Gute Nacht|おやすみなさい',
'How are you?|आप कैसे हैं?|ನೀವು ಹೇಗಿದ್ದೀರಿ?|நீங்கள் எப்படி இருக்கிறீர்கள்?|మీరు ఎలా ఉన్నారు?|സുഖമാണോ?|আপনি কেমন আছেন?|तुम्ही कसे आहात?|તમે કેમ છો?|ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?|Comment allez-vous ?|¿Cómo estás?|Wie geht es Ihnen?|お元気ですか？',
'I do not understand|मुझे समझ नहीं आया|ನನಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ|எனக்குப் புரியவில்லை|నాకు అర్థం కాలేదు|എനിക്ക് മനസ്സിലായില്ല|আমি বুঝতে পারছি না|मला समजले नाही|મને સમજાયું નહીં|ਮੈਨੂੰ ਸਮਝ ਨਹੀਂ ਆਈ|Je ne comprends pas|No entiendo|Ich verstehe nicht|わかりません',
'Where is the station?|स्टेशन कहाँ है?|ನಿಲ್ದಾಣ ಎಲ್ಲಿದೆ?|நிலையம் எங்கே?|స్టేషన్ ఎక్కడ ఉంది?|സ്റ്റേഷൻ എവിടെയാണ്?|স্টেশন কোথায়?|स्टेशन कुठे आहे?|સ્ટેશન ક્યાં છે?|ਸਟੇਸ਼ਨ ਕਿੱਥੇ ਹੈ?|Où est la gare ?|¿Dónde está la estación?|Wo ist der Bahnhof?|駅はどこですか？'
].map(r=>r.split('|'));
const norm=s=>String(s).normalize('NFC').toLowerCase().replace(/[?!¿？.!。]/g,'').trim();
export function phraseTranslate(text, from, to){const a=columns.indexOf(from),b=columns.indexOf(to); if(a<0||b<0)return null;const r=rows.find(r=>norm(r[a])===norm(text));return r?.[b]||null;}
export function offlineWords(profile){const a=columns.indexOf(profile.native),b=columns.indexOf(profile.target);return rows.map((r,i)=>({id:`phrase-${i}`,word:r[b],meaning_native:r[a],meaning_target:r[0],example:r[b],example_translation:r[a],pron:'',topic:'Everyday phrases',level:'Beginner',source:'builtin',synonyms:[],usage_note:'Basic phrasebook entry; context and register may vary.'}));}
export function offlineQuiz(profile,count){const list=offlineWords(profile).sort(()=>Math.random()-.5);return list.slice(0,count).map((w,i)=>({id:`local-${i}`,type:'mcq',concept:'vocabulary',prompt:`Choose the ${profile.target} equivalent of “${w.meaning_native}”.`,answer:w.word,options:[w.word,...[...new Set(list.filter(x=>x.word!==w.word).map(x=>x.word))].slice(0,3)].sort(()=>Math.random()-.5),explanation:`${w.meaning_native} → ${w.word}`,accept:[]}));}
