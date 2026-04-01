/**
 * Exhaustive Etsy Keyword Seed List
 *
 * Covers all 17 top-level Etsy categories, their subcategories,
 * and key product types. The cron job rotates through daily batches
 * so even with API limits, full coverage is achieved in ~4 days.
 *
 * Total: ~1200 keywords
 *
 * To add more: push new strings into the appropriate category array.
 */

// ─── 1. Jewelry & Accessories ───────────────────────────────────
const jewelry = [
  // Necklaces
  'necklace', 'pendant necklace', 'choker necklace', 'chain necklace', 'layered necklace',
  'statement necklace', 'pearl necklace', 'diamond necklace', 'gold necklace', 'silver necklace',
  'rose gold necklace', 'name necklace', 'birthstone necklace', 'locket necklace', 'beaded necklace',
  'bar necklace', 'coin necklace', 'initial necklace', 'heart necklace', 'cross necklace',
  // Rings
  'ring', 'engagement ring', 'wedding ring', 'stackable rings', 'signet ring',
  'promise ring', 'cocktail ring', 'mood ring', 'gemstone ring', 'opal ring',
  'silver ring', 'gold ring', 'rose gold ring', 'adjustable ring', 'thumb ring',
  'midi ring', 'couple rings', 'spinner ring', 'men ring', 'anxiety ring',
  // Earrings
  'earrings', 'stud earrings', 'hoop earrings', 'drop earrings', 'dangle earrings',
  'huggie earrings', 'pearl earrings', 'statement earrings', 'threader earrings', 'clip on earrings',
  'gold earrings', 'silver earrings', 'crystal earrings', 'boho earrings', 'mismatched earrings',
  // Bracelets
  'bracelet', 'charm bracelet', 'friendship bracelet', 'beaded bracelet', 'cuff bracelet',
  'bangle bracelet', 'tennis bracelet', 'leather bracelet', 'wrap bracelet', 'couples bracelet',
  'name bracelet', 'gold bracelet', 'silver bracelet', 'anklet', 'ankle bracelet',
  // Other Jewelry
  'brooch', 'vintage brooch', 'pin', 'enamel pin', 'body chain',
  'toe ring', 'nose ring', 'septum ring', 'belly button ring', 'ear cuff',
  'jewelry set', 'bridal jewelry', 'minimalist jewelry', 'boho jewelry', 'handmade jewelry',
  'custom jewelry', 'personalized jewelry', 'birthstone jewelry', 'wire wrapped jewelry', 'resin jewelry',
  'clay jewelry', 'polymer clay earrings', 'pressed flower jewelry', 'crystal jewelry', 'healing crystal jewelry',
];

// ─── 2. Accessories ─────────────────────────────────────────────
const accessories = [
  // Hair Accessories
  'hair clip', 'hair bow', 'hair tie', 'scrunchie', 'headband',
  'hair pin', 'barrette', 'hair comb', 'flower crown', 'hair vine',
  'hair stick', 'silk scrunchie', 'claw clip', 'pearl hair pin', 'bridal hair piece',
  // Hats & Caps
  'beanie', 'bucket hat', 'sun hat', 'baseball cap', 'trucker hat',
  'beret', 'winter hat', 'knit hat', 'straw hat', 'fedora',
  // Scarves & Wraps
  'scarf', 'silk scarf', 'infinity scarf', 'bandana', 'shawl',
  'pashmina', 'neck gaiter', 'head scarf', 'knit scarf', 'cotton scarf',
  // Sunglasses & Eyewear
  'sunglasses', 'glasses chain', 'blue light glasses', 'reading glasses', 'eyeglass holder',
  // Belts & Suspenders
  'leather belt', 'belt buckle', 'western belt', 'suspenders', 'waist belt',
  // Watches
  'watch', 'wooden watch', 'engraved watch', 'vintage watch', 'minimalist watch',
  // Keychains
  'keychain', 'personalized keychain', 'leather keychain', 'acrylic keychain', 'resin keychain',
  'custom keychain', 'car keychain', 'photo keychain', 'name keychain', 'keychain charm',
  // Gloves & Mittens
  'gloves', 'knit mittens', 'fingerless gloves', 'leather gloves', 'winter gloves',
];

// ─── 3. Clothing ────────────────────────────────────────────────
const clothing = [
  // Tops
  't-shirt', 'graphic tee', 'custom t-shirt', 'crop top', 'tank top',
  'blouse', 'tunic', 'sweater', 'cardigan', 'hoodie',
  'sweatshirt', 'vintage t-shirt', 'oversized tee', 'linen top', 'crochet top',
  // Dresses
  'dress', 'maxi dress', 'midi dress', 'sundress', 'wrap dress',
  'linen dress', 'boho dress', 'vintage dress', 'bridesmaid dress', 'prom dress',
  'cocktail dress', 'summer dress', 'plus size dress', 'maternity dress', 'flower girl dress',
  // Bottoms
  'jeans', 'pants', 'skirt', 'shorts', 'leggings',
  'wide leg pants', 'linen pants', 'palazzo pants', 'joggers', 'culottes',
  // Outerwear
  'jacket', 'denim jacket', 'leather jacket', 'blazer', 'coat',
  'kimono', 'poncho', 'vest', 'puffer jacket', 'rain jacket',
  // Activewear
  'yoga pants', 'sports bra', 'workout set', 'athletic wear', 'gym clothes',
  // Sleepwear & Underwear
  'pajamas', 'robe', 'silk robe', 'nightgown', 'lingerie',
  'bralette', 'satin pajamas', 'matching pajama set', 'lounge wear', 'underwear',
  // Other Clothing
  'romper', 'jumpsuit', 'overalls', 'apron', 'costume',
  'cosplay costume', 'halloween costume', 'matching family outfits', 'couple shirts', 'baby onesie',
];

// ─── 4. Shoes ───────────────────────────────────────────────────
const shoes = [
  'sandals', 'leather sandals', 'platform sandals', 'gladiator sandals', 'slides',
  'boots', 'ankle boots', 'combat boots', 'cowboy boots', 'rain boots',
  'sneakers', 'custom sneakers', 'canvas shoes', 'slip on shoes', 'loafers',
  'moccasins', 'clogs', 'espadrilles', 'ballet flats', 'mary jane shoes',
  'wedding shoes', 'bridal shoes', 'high heels', 'platform shoes', 'wedge shoes',
  'slippers', 'house slippers', 'knit slippers', 'mules', 'oxfords',
  'shoe clips', 'shoe charms', 'shoelaces', 'insoles', 'baby shoes',
  'toddler shoes', 'men leather shoes', 'handmade shoes', 'custom shoes', 'vegan shoes',
];

// ─── 5. Home & Living ──────────────────────────────────────────
const homeLiving = [
  // Wall Decor
  'wall art', 'canvas wall art', 'metal wall art', 'wood wall art', 'macrame wall hanging',
  'gallery wall set', 'framed print', 'poster', 'wall tapestry', 'wall shelf',
  'floating shelf', 'picture frame', 'photo frame', 'mirror', 'wall mirror',
  'wall clock', 'neon sign', 'custom neon sign', 'led sign', 'wall decal',
  'wall sticker', 'vinyl decal', 'wall mural', 'peel and stick wallpaper', 'wallpaper',
  // Candles & Holders
  'candle', 'soy candle', 'scented candle', 'beeswax candle', 'pillar candle',
  'candle holder', 'candlestick', 'tealight holder', 'wax melts', 'candle gift set',
  // Vases & Plants
  'vase', 'flower vase', 'ceramic vase', 'bud vase', 'planter',
  'plant pot', 'hanging planter', 'succulent planter', 'macrame plant hanger', 'terrarium',
  'artificial flowers', 'dried flowers', 'dried flower bouquet', 'preserved flowers', 'fake plants',
  // Bedding
  'duvet cover', 'bed sheets', 'pillowcase', 'throw pillow', 'pillow cover',
  'cushion cover', 'quilt', 'patchwork quilt', 'weighted blanket', 'throw blanket',
  'knit blanket', 'chunky knit blanket', 'fleece blanket', 'personalized blanket', 'baby blanket',
  // Furniture
  'coffee table', 'side table', 'nightstand', 'bookshelf', 'desk',
  'console table', 'bar cart', 'shoe rack', 'coat rack', 'plant stand',
  // Rugs & Mats
  'rug', 'area rug', 'doormat', 'custom doormat', 'bath mat',
  'kitchen rug', 'runner rug', 'woven rug', 'persian rug', 'shag rug',
  // Lighting
  'lamp', 'table lamp', 'floor lamp', 'pendant light', 'chandelier',
  'fairy lights', 'string lights', 'night light', 'led strip', 'desk lamp',
  // Home Decor
  'ceramic tray', 'decorative tray', 'bookend', 'figurine', 'sculpture',
  'wind chime', 'dream catcher', 'incense holder', 'diffuser', 'essential oil diffuser',
  'coaster', 'wooden coaster', 'resin coaster', 'custom coaster', 'cork coaster',
  // Storage & Organization
  'storage basket', 'woven basket', 'jewelry box', 'wooden box', 'storage bin',
  'organizer', 'desk organizer', 'wall organizer', 'key holder wall', 'mail organizer',
  // Curtains
  'curtain', 'linen curtain', 'sheer curtain', 'blackout curtain', 'shower curtain',
];

// ─── 6. Art & Collectibles ──────────────────────────────────────
const artCollectibles = [
  // Prints & Posters
  'art print', 'digital art print', 'watercolor print', 'botanical print', 'abstract art print',
  'landscape print', 'minimalist print', 'retro poster', 'vintage poster', 'movie poster',
  'travel poster', 'nursery art print', 'typography print', 'line art print', 'fashion illustration',
  // Original Art
  'original painting', 'oil painting', 'acrylic painting', 'watercolor painting', 'abstract painting',
  'portrait painting', 'custom portrait', 'pet portrait', 'family portrait', 'landscape painting',
  'commission art', 'custom oil painting', 'modern art', 'contemporary art', 'impressionist art',
  // Sculpture & 3D Art
  'sculpture', 'ceramic sculpture', 'wood carving', 'clay sculpture', '3d printed art',
  'resin art', 'epoxy resin art', 'metal sculpture', 'glass art', 'stained glass',
  // Photography
  'photography print', 'fine art photography', 'nature photography', 'black and white photography', 'aerial photography',
  // Collectibles
  'vintage collectible', 'antique collectible', 'figurine', 'action figure', 'coin collection',
  'stamp collection', 'sports memorabilia', 'movie memorabilia', 'vintage toy', 'retro collectible',
];

// ─── 7. Craft Supplies & Tools ──────────────────────────────────
const craftSupplies = [
  // Beads & Findings
  'beads', 'glass beads', 'seed beads', 'crystal beads', 'gemstone beads',
  'wooden beads', 'letter beads', 'spacer beads', 'charms', 'jewelry findings',
  'jump rings', 'lobster clasp', 'earring hooks', 'crimp beads', 'toggle clasp',
  // Fabric & Textiles
  'fabric', 'cotton fabric', 'linen fabric', 'silk fabric', 'velvet fabric',
  'quilting fabric', 'fabric by the yard', 'felt', 'tulle', 'lace fabric',
  'burlap', 'canvas fabric', 'upholstery fabric', 'embroidery fabric', 'fat quarters',
  // Yarn & Fiber
  'yarn', 'cotton yarn', 'wool yarn', 'chunky yarn', 'acrylic yarn',
  'bamboo yarn', 'merino wool', 'macrame cord', 'embroidery floss', 'crochet thread',
  // Stamps & Ink
  'rubber stamp', 'clear stamp', 'wax seal stamp', 'custom stamp', 'ink pad',
  'embossing powder', 'stamp set', 'alphabet stamp', 'address stamp', 'return address stamp',
  // Patterns & Tutorials
  'sewing pattern', 'crochet pattern', 'knitting pattern', 'embroidery pattern', 'cross stitch pattern',
  'pdf pattern', 'amigurumi pattern', 'quilt pattern', 'macrame pattern', 'doll pattern',
  // Tools
  'crochet hook', 'knitting needles', 'embroidery hoop', 'rotary cutter', 'cutting mat',
  'sewing machine', 'serger', 'glue gun', 'heat press', 'sublimation printer',
  // Raw Materials
  'resin', 'epoxy resin', 'silicone mold', 'resin mold', 'pigment powder',
  'mica powder', 'gold leaf', 'dried flowers for resin', 'glitter', 'rhinestones',
  // Leather & Wood
  'leather hide', 'leather scraps', 'leather tools', 'wood blanks', 'wood slices',
  'wood rounds', 'unfinished wood', 'balsa wood', 'plywood sheets', 'wood burning tool',
  // Paper & Cardstock
  'cardstock', 'scrapbook paper', 'tissue paper', 'kraft paper', 'vellum paper',
  'origami paper', 'crepe paper', 'washi tape', 'sticker paper', 'transfer paper',
];

// ─── 8. Wedding & Party ────────────────────────────────────────
const weddingParty = [
  // Wedding Decor
  'wedding invitation', 'wedding card', 'save the date', 'rsvp card', 'wedding program',
  'wedding menu', 'table numbers', 'place cards', 'escort cards', 'seating chart',
  'wedding banner', 'wedding arch', 'wedding backdrop', 'aisle runner', 'pew decoration',
  'wedding centerpiece', 'reception decor', 'head table decor', 'wedding lantern', 'wedding candle',
  // Wedding Attire & Accessories
  'wedding veil', 'bridal veil', 'wedding tiara', 'bridal crown', 'wedding hairpiece',
  'garter', 'wedding sash', 'flower girl basket', 'ring bearer pillow', 'wedding hanger',
  'groomsmen gift', 'bridesmaid gift', 'bridesmaid proposal', 'maid of honor gift', 'mother of the bride gift',
  // Cake & Food
  'cake topper', 'wedding cake topper', 'custom cake topper', 'cupcake topper', 'cake stand',
  'wedding favors', 'party favors', 'candy box', 'favor tag', 'favor bag',
  // Party Supplies
  'birthday banner', 'happy birthday sign', 'birthday decoration', 'party decoration', 'balloon garland',
  'balloon arch', 'confetti', 'party hat', 'photo booth props', 'photo booth frame',
  'baby shower decoration', 'gender reveal', 'bridal shower decoration', 'bachelorette party', 'bachelor party',
  'graduation party', 'retirement party', 'anniversary decoration', 'engagement party', 'rehearsal dinner',
  // Gift Wrap
  'gift wrap', 'wrapping paper', 'gift bag', 'gift tag', 'ribbon',
  'tissue paper', 'gift box', 'jewelry gift box', 'organza bag', 'muslin bag',
];

// ─── 9. Bags & Purses ──────────────────────────────────────────
const bagsPurses = [
  'tote bag', 'canvas tote bag', 'personalized tote bag', 'beach bag', 'market bag',
  'crossbody bag', 'leather crossbody', 'shoulder bag', 'messenger bag', 'sling bag',
  'clutch', 'evening clutch', 'wristlet', 'cosmetic bag', 'makeup bag',
  'travel bag', 'duffel bag', 'weekender bag', 'laptop bag', 'laptop sleeve',
  'backpack', 'leather backpack', 'canvas backpack', 'diaper bag', 'gym bag',
  'fanny pack', 'belt bag', 'coin purse', 'card holder', 'wallet',
  'leather wallet', 'minimalist wallet', 'money clip', 'passport holder', 'luggage tag',
  'drawstring bag', 'crochet bag', 'woven bag', 'straw bag', 'bucket bag',
  'handbag', 'leather handbag', 'vegan leather bag', 'custom bag', 'personalized bag',
];

// ─── 10. Bath & Beauty ─────────────────────────────────────────
const bathBeauty = [
  // Skincare
  'soap', 'handmade soap', 'bar soap', 'goat milk soap', 'charcoal soap',
  'face serum', 'face oil', 'moisturizer', 'body butter', 'body lotion',
  'lip balm', 'lip scrub', 'face mask', 'clay mask', 'eye cream',
  'sunscreen', 'toner', 'body scrub', 'sugar scrub', 'salt scrub',
  // Bath
  'bath bomb', 'bath salt', 'bubble bath', 'shower steamer', 'bath soak',
  'bath oil', 'milk bath', 'bath gift set', 'self care gift box', 'spa gift set',
  // Hair Care
  'shampoo bar', 'conditioner bar', 'hair oil', 'hair serum', 'dry shampoo',
  'hair mask', 'leave in conditioner', 'beard oil', 'beard balm', 'beard kit',
  // Fragrance
  'perfume', 'perfume oil', 'solid perfume', 'cologne', 'body mist',
  'essential oil', 'essential oil blend', 'aromatherapy', 'reed diffuser', 'room spray',
  // Makeup
  'lip gloss', 'lipstick', 'eyeshadow palette', 'mascara', 'setting spray',
  // Nail
  'nail polish', 'press on nails', 'nail stickers', 'nail wraps', 'gel nails',
  'nail art', 'manicure set', 'cuticle oil', 'nail file', 'acrylic nails',
];

// ─── 11. Toys & Entertainment ───────────────────────────────────
const toysEntertainment = [
  // Stuffed Animals & Dolls
  'stuffed animal', 'plush toy', 'crochet toy', 'amigurumi', 'teddy bear',
  'rag doll', 'handmade doll', 'cloth doll', 'waldorf doll', 'custom doll',
  // Puzzles & Games
  'puzzle', 'wooden puzzle', 'jigsaw puzzle', 'custom puzzle', 'name puzzle',
  'board game', 'card game', 'dice set', 'dnd dice', 'tabletop game',
  // Kids Toys
  'montessori toy', 'wooden toy', 'sensory toy', 'busy board', 'stacking toy',
  'play kitchen', 'toy car', 'building blocks', 'play dough', 'felt toy',
  'teething toy', 'baby rattle', 'baby mobile', 'crib mobile', 'activity mat',
  // Outdoor
  'kite', 'garden game', 'bubble wand', 'swing', 'sandbox toy',
  // Music
  'guitar pick', 'custom guitar pick', 'music box', 'kalimba', 'drum',
];

// ─── 12. Pet Supplies ───────────────────────────────────────────
const petSupplies = [
  // Dog
  'dog collar', 'personalized dog collar', 'dog leash', 'dog harness', 'dog bandana',
  'dog tag', 'custom dog tag', 'dog bed', 'dog bowl', 'dog toy',
  'dog treat', 'dog sweater', 'dog jacket', 'dog bow tie', 'dog birthday',
  // Cat
  'cat collar', 'cat bed', 'cat tree', 'cat toy', 'cat scratcher',
  'cat bowl', 'cat tag', 'cat bandana', 'catnip toy', 'cat cave',
  // Other Pets
  'pet portrait', 'custom pet portrait', 'pet memorial', 'pet loss gift', 'pet ornament',
  'pet id tag', 'pet carrier', 'pet clothing', 'pet accessories', 'hamster cage',
  'bird feeder', 'bird house', 'aquarium decor', 'reptile hide', 'rabbit toy',
];

// ─── 13. Paper & Party Supplies / Stationery ───────────────────
const stationery = [
  // Planners & Journals
  'planner', 'daily planner', 'weekly planner', 'budget planner', 'meal planner',
  'journal', 'leather journal', 'bullet journal', 'gratitude journal', 'prayer journal',
  'notebook', 'custom notebook', 'personalized notebook', 'sketchbook', 'guest book',
  // Cards & Invitations
  'greeting card', 'birthday card', 'thank you card', 'christmas card', 'valentines card',
  'mothers day card', 'fathers day card', 'sympathy card', 'get well card', 'funny card',
  'invitation', 'birthday invitation', 'baby shower invitation', 'graduation invitation', 'custom invitation',
  // Stickers
  'sticker', 'laptop sticker', 'vinyl sticker', 'planner sticker', 'die cut sticker',
  'holographic sticker', 'custom sticker', 'sticker sheet', 'bumper sticker', 'water bottle sticker',
  // Bookmarks & Office
  'bookmark', 'custom bookmark', 'leather bookmark', 'resin bookmark', 'corner bookmark',
  'pen', 'fountain pen', 'calligraphy pen', 'pencil case', 'desk pad',
  'sticky notes', 'notepad', 'memo pad', 'clipboard', 'letter opener',
  // Stamps & Seals
  'wax seal', 'wax seal kit', 'wax seal stamp', 'library stamp', 'book stamp',
];

// ─── 14. Digital Products ───────────────────────────────────────
const digitalProducts = [
  // Printable Art
  'digital download', 'printable wall art', 'digital print', 'printable poster', 'nursery printable',
  'bible verse printable', 'quote print', 'digital illustration', 'clipart', 'digital clipart',
  // Planners & Organizers
  'digital planner', 'goodnotes planner', 'ipad planner', 'budget spreadsheet', 'meal plan template',
  'habit tracker', 'printable calendar', 'printable planner', 'to do list printable', 'chore chart',
  // Templates
  'resume template', 'cv template', 'canva template', 'instagram template', 'social media template',
  'business card template', 'logo template', 'wedding invitation template', 'menu template', 'flyer template',
  // SVG & Design Files
  'svg file', 'svg bundle', 'svg cut file', 'cricut svg', 'silhouette file',
  'laser cut file', 'dxf file', 'png clipart', 'sublimation design', 'dtf transfer',
  // Fonts & Graphics
  'font', 'handwritten font', 'script font', 'display font', 'font bundle',
  'digital paper', 'scrapbook digital paper', 'pattern design', 'seamless pattern', 'watercolor clipart',
  // Photography & Mockups
  'lightroom preset', 'photo preset', 'mockup', 'product mockup', 'frame mockup',
  // Patterns (Digital)
  'crochet pattern pdf', 'knitting pattern pdf', 'sewing pattern pdf', 'embroidery pattern pdf', 'cross stitch pattern pdf',
];

// ─── 15. Kitchen & Dining ───────────────────────────────────────
const kitchenDining = [
  // Drinkware
  'mug', 'coffee mug', 'custom mug', 'personalized mug', 'funny mug',
  'travel mug', 'tumbler', 'custom tumbler', 'wine glass', 'whiskey glass',
  'beer glass', 'pint glass', 'champagne flute', 'stemless wine glass', 'water bottle',
  // Kitchenware
  'cutting board', 'personalized cutting board', 'wooden cutting board', 'serving board', 'charcuterie board',
  'spoon rest', 'wooden spoon', 'spatula', 'rolling pin', 'measuring cups',
  'apron', 'personalized apron', 'oven mitt', 'pot holder', 'kitchen towel',
  // Dining
  'plate', 'ceramic plate', 'dinner plate', 'bowl', 'serving bowl',
  'napkin', 'cloth napkin', 'napkin ring', 'placemat', 'table runner',
  'cake stand', 'tiered tray', 'lazy susan', 'salt and pepper shakers', 'butter dish',
  // Food & Drink
  'tea', 'loose leaf tea', 'tea sampler', 'coffee', 'hot chocolate',
  'cookie', 'chocolate', 'candy', 'jam', 'honey',
];

// ─── 16. Vintage (20+ Years Old) ───────────────────────────────
const vintage = [
  'vintage jewelry', 'vintage ring', 'vintage brooch', 'vintage necklace', 'vintage earrings',
  'vintage clothing', 'vintage dress', 'vintage jacket', 'vintage denim', 'vintage band tee',
  'vintage furniture', 'vintage chair', 'vintage table', 'vintage lamp', 'vintage mirror',
  'vintage decor', 'vintage vase', 'vintage pottery', 'vintage glass', 'vintage tin',
  'retro decor', 'mid century modern', 'art deco', 'victorian antique', 'vintage book',
  'vintage postcard', 'vintage map', 'vintage poster', 'vintage sign', 'vintage camera',
  'vintage watch', 'antique clock', 'vintage typewriter', 'vintage suitcase', 'vintage record',
];

// ─── 17. Cross-Category / Seasonal / Trending ───────────────────
const crossCategory = [
  // Personalized / Custom
  'personalized gift', 'custom gift', 'engraved gift', 'monogram', 'name sign',
  'custom name sign', 'family name sign', 'custom portrait', 'custom pet portrait', 'custom map',
  // Seasonal
  'christmas ornament', 'christmas decoration', 'christmas stocking', 'christmas gift', 'advent calendar',
  'halloween decoration', 'halloween costume', 'fall decor', 'autumn wreath', 'thanksgiving decor',
  'valentines day gift', 'valentine card', 'easter decoration', 'easter basket', 'spring wreath',
  'summer decor', 'fourth of july', 'independence day', 'new year decoration', 'st patricks day',
  // Occasions
  'birthday gift', 'anniversary gift', 'wedding gift', 'baby shower gift', 'graduation gift',
  'housewarming gift', 'retirement gift', 'teacher gift', 'thank you gift', 'sympathy gift',
  'mothers day gift', 'fathers day gift', 'best friend gift', 'boyfriend gift', 'girlfriend gift',
  'husband gift', 'wife gift', 'groomsmen gift', 'bridesmaid gift', 'coworker gift',
  // Trending / Popular
  'cottagecore', 'dark academia', 'goblincore', 'mushroom decor', 'celestial jewelry',
  'zodiac necklace', 'astrology gift', 'tarot card', 'witchy decor', 'spiritual gift',
  'self care kit', 'mental health', 'anxiety ring', 'fidget toy', 'sensory toy',
  // Home Office
  'desk mat', 'mouse pad', 'custom mouse pad', 'monitor stand', 'cable organizer',
  'laptop stand', 'webcam cover', 'phone stand', 'desk plant', 'office decor',
  // Baby & Kids
  'baby blanket', 'baby name sign', 'nursery decor', 'growth chart', 'baby milestone cards',
  'baby clothes', 'baby bib', 'pacifier clip', 'baby shoes', 'newborn gift',
  'kids room decor', 'childrens book', 'kids costume', 'kids backpack', 'lunch box',
  // Eco & Sustainability
  'reusable bag', 'beeswax wrap', 'reusable straw', 'bamboo toothbrush', 'zero waste kit',
  'compost bin', 'seed paper', 'plantable card', 'upcycled', 'recycled',
  // Religious & Spiritual
  'bible cover', 'prayer beads', 'rosary', 'evil eye bracelet', 'hamsa',
  'sage bundle', 'palo santo', 'crystal set', 'chakra bracelet', 'meditation cushion',
];

// ═══════════════════════════════════════════════════════════════
// Merge, deduplicate, and export
// ═══════════════════════════════════════════════════════════════

const allCategories = {
  jewelry,
  accessories,
  clothing,
  shoes,
  homeLiving,
  artCollectibles,
  craftSupplies,
  weddingParty,
  bagsPurses,
  bathBeauty,
  toysEntertainment,
  petSupplies,
  stationery,
  digitalProducts,
  kitchenDining,
  vintage,
  crossCategory,
};

// Flatten + deduplicate (case-insensitive)
const seen = new Set();
const seedKeywords = [];
for (const cat of Object.values(allCategories)) {
  for (const kw of cat) {
    const lower = kw.toLowerCase().trim();
    if (!seen.has(lower)) {
      seen.add(lower);
      seedKeywords.push(lower);
    }
  }
}

module.exports = seedKeywords;
module.exports.categories = allCategories;
