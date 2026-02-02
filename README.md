# 🎮 Desert Storm - Team Assignment Generator

A web-based platform for generating strategic team assignments for **Desert Storm** game mode. Upload your player data, get visual map infographics with player names positioned on buildings.

---

## 🚀 **Quick Start**

### **Option 1: Local Use (Recommended)**
1. Download `desert_storm_FINAL.html`
2. Open the HTML file in your browser (Chrome, Firefox, Safari, Edge)
3. Follow the on-screen instructions

### **Option 2: GitHub Pages Hosting**
1. Create a GitHub repository
2. Upload the HTML file and rename it to `index.html`
3. Enable GitHub Pages in Settings → Pages
4. Share the URL with your team

**No installation, no server, no dependencies required!** ✨

---

## 📋 **How to Use**

### **Step 1: Prepare Your Data**
1. Click **"Download Template"** in the HTML
2. Open the Excel template
3. Fill in player information:
   - **Column B:** Player Name
   - **Column D:** E1 troops (Tank, Aero, or Missile)
   - **Column E:** E1 total power (e.g., 65.0)
   - **Column F:** Desert Storm - Team A (1 = selected)
   - **Column G:** Desert Storm - Team B (1 = selected)

**Template Structure:**
```
Row 1: Instructions
Row 2: Empty
Row 3: Headers (Player Name, E1 troops, Desert Storm - Team A, etc.)
Row 4+: Player data
```

### **Step 2: Upload**
1. Save your Excel file
2. Click **"Upload Your File"** in the HTML
3. Select your completed Excel file
4. System validates and shows: "✅ Team A: 20 | Team B: 20"

### **Step 3: Download Maps**
1. Click **"Download Team A Map"**
2. Click **"Download Team B Map"**
3. Get PNG images (1080×1112px) with player names on buildings

**Output:** Visual maps showing which players go to which buildings with color-coded priorities

---

## 🗺️ **Map Features**

### **Visual Layout**
- **1080 × 1112px** high-quality PNG images
- **Map background** with building locations
- **Player names** displayed at precise coordinates
- **Color-coded boxes** by building priority
- **Bomb Squad section** at bottom with roaming players

### **Building Positions**
Player names appear on the map at these precise locations:
```
LEFT SIDE BUILDINGS:
- Info center: [308, 163]
- Oil Refinery 1: [175, 274]
- Field Hospital 1: [167, 475]
- Field Hospital 3: [264, 587]

RIGHT SIDE BUILDINGS:
- Field Hospital 4: [794, 146]
- Field Hospital 2: [930, 247]
- Oil Refinery 2: [920, 476]
- Science Hub: [820, 600]

BOTTOM SECTION:
- Bomb Squad: 4 players displayed in 2x2 grid
```

### **Color Coding**
Buildings are color-coded by priority:
- **Priority 1 (Dark Red):** Bomb Squad
- **Priority 2 (Orange):** Oil Refineries, Science Hub
- **Priority 3 (Teal):** Field Hospitals
- **Priority 4 (Blue):** Info Center

---

## 🎯 **Assignment Strategy**

### **Priority-Based Assignment**
- **P1 (Highest):** Bomb Squad (4 players) → Strongest roaming support
- **P2:** Oil Refinery 1, Oil Refinery 2, Science Hub (2 each) → Strong defenders
- **P3:** Field Hospitals 1-4 (2 each) → Balanced support
- **P4 (Lower):** Info Center (2 players) → Rear support

### **Power Distribution**
Players are assigned by E1 total power:
1. Sort all eligible players by power (highest first)
2. Assign top players to P1 buildings
3. Continue through P2, P3, P4 in descending power order
4. Result: Strongest players defend highest priority buildings

**Example Assignment:**
```
P1: Bomb Squad
  → Player1 (68M)
  → Player2 (65M)
  → Player3 (64M)
  → Player4 (62M)

P2: Oil Refinery 1
  → Player5 (60M)
  → Player6 (59M)

P2: Science Hub
  → Player7 (58M)
  → Player8 (57M)

P3: Field Hospital 1
  → Player9 (56M)
  → Player10 (55M)

P4: Info Center
  → Player19 (51M)
  → Player20 (50M)
```

---

## 📊 **Desert Storm Buildings**

```
Priority 1: Bomb Squad (4 players - roaming support)
  - Highest power players
  - Roam free, help others
  - Most critical role

Priority 2: (6 players total)
  - Oil Refinery 1 (2 players)
  - Oil Refinery 2 (2 players)
  - Science Hub (2 players)
  - Key strategic buildings

Priority 3: (8 players total)
  - Field Hospital 1 (2 players)
  - Field Hospital 2 (2 players)
  - Field Hospital 3 (2 players)
  - Field Hospital 4 (2 players)
  - Support positions

Priority 4: (2 players)
  - Info Center (2 players)
  - Rear support

Total: 20 players per team
```

---

## ✅ **Features**

- ✅ **Visual Maps:** Player names on actual map image
- ✅ **No Truncation:** Full player names displayed
- ✅ **Dynamic Positioning:** Names adjust to stay on screen
- ✅ **Color-Coded Priorities:** Easy visual identification
- ✅ **High Quality:** 1080px width PNG outputs
- ✅ **Coordinate Picker:** Interactive positioning tool (separate file)
- ✅ **No Installation:** Pure HTML/JavaScript, works in any browser
- ✅ **Offline Capable:** No internet needed after initial load
- ✅ **Excel Integration:** Upload/download Excel files
- ✅ **Checkbox Support:** Accepts 1, true, 'Y', or 'TRUE' as selections
- ✅ **Error Validation:** Checks for missing players, wrong formats
- ✅ **Console Debugging:** See detailed assignment logs
- ✅ **Mobile Friendly:** Works on phones and tablets

---

## 🔧 **Technical Details**

### **Technologies Used:**
- **HTML5** - Structure
- **CSS3** - Styling
- **JavaScript (ES6+)** - Logic and processing
- **SheetJS (XLSX.js)** - Excel file handling
- **Canvas API** - Image generation and map overlay

### **Browser Compatibility:**
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

### **File Sizes:**
- `desert_storm_FINAL.html`: ~214 KB
- Generated PNG maps: ~200-400 KB each
- Excel template: ~8 KB

### **Performance:**
- Excel processing: < 1 second
- Map generation: < 2 seconds
- Works with 100+ player lists

### **Map Specifications:**
- **Source map:** 2000×1412px scaled to 1080px
- **Canvas layout:** 100px title + 762px map + 250px bomb squad
- **Total height:** 1112px
- **Output format:** PNG with 95% quality

---

## 🐛 **Troubleshooting**

### **"NO PLAYERS!" Error**
**Problem:** No players marked in Excel  
**Solution:** Make sure you put `1` in column F (Team A) or G (Team B) for each player

### **"Excel file must contain..." Error**
**Problem:** Sheet names don't match  
**Solution:** Sheets must be named "Players", "Desert Storm- Team A", "Desert Storm- Team B" (note the space after "Storm-")

### **Player Names Not Showing on Map**
**Problem:** Coordinates might be off-screen or players not marked  
**Solution:**
1. Make sure players have `1` in column F or G
2. Check console logs (F12) for debugging info
3. Use coordinate picker tool to adjust positions
4. Verify Excel template structure matches requirements

### **Names Appear Off-Screen**
**Problem:** Building coordinates need adjustment  
**Solution:** 
1. Download `coordinate_picker.html`
2. Click on correct building positions
3. Provide coordinates to administrator for HTML update

### **Map Won't Download**
**Problem:** Browser blocking download  
**Solution:**
1. Check browser console (F12) for errors
2. Make sure pop-ups are allowed
3. Try a different browser (Chrome recommended)

### **Names Are Truncated/Cut Off**
**Problem:** This should not happen in latest version  
**Solution:** Download the updated HTML file. Latest version shows full names and adjusts position automatically.

### **Template Downloads Empty File**
**Problem:** Browser security settings  
**Solution:** Allow downloads from local HTML files, or host on GitHub Pages

---

## 📖 **Excel Template Guide**

### **Required Columns:**

#### **Players Sheet:**
| Column | Name | Description | Example |
|--------|------|-------------|---------|
| A | Row Number | Sequential number | 1, 2, 3... |
| B | Player Name | Player's in-game name | "Sw3k" |
| C | Total Hero Power(M) | Optional | 95 |
| D | E1 troops | Tank, Aero, or Missile | "Tank" |
| E | E1 total power(M) | Player's E1 power | 65.0 |
| F | Desert Storm - Team A | 1 = selected, 0 = not | 1 |
| G | Desert Storm - Team B | 1 = selected, 0 = not | 0 |

#### **Building Sheets (Team A & Team B):**
| Column | Name | Description |
|--------|------|-------------|
| A | Buildig Name | Building name (exact match) |
| B | Priority | Building priority (1-4) |
| C | Player name | Leave empty (auto-filled) |

### **Important Notes:**
- ✅ Headers must be exact (including typo "Buildig")
- ✅ Use `1` for selected players (not "X" or "Yes")
- ✅ E1 power must be numeric (65.0, not "65M")
- ✅ Troop type must be: Tank, Aero, or Missile (exact spelling)
- ✅ Exactly 20 players per team required

### **Building Names (Must Match Exactly):**
```
- Bomb Squad
- Oil Rafinery 1 (note: "Rafinery" not "Refinery")
- Oil Rafinery 2
- Science Hub
- Field Hospital 1
- Field Hospital 2
- Field Hospital 3
- Field Hospital 4
- Info center
```

**Note:** The template includes a typo handling for "Field Hopsital 1" (one 'o') - both spellings work.

---

## 🎨 **Coordinate Picker Tool**

### **What It Does:**
Interactive tool to set precise positions for player names on the map.

### **How to Use:**
1. Open `coordinate_picker.html` in browser
2. You'll see the Desert Storm map with crosshair cursor
3. Click on each building in sequence:
   - Info center
   - Oil Refinery 1
   - Field Hospital 1
   - Field Hospital 3
   - Field Hospital 4
   - Field Hospital 2
   - Oil Refinery 2
   - Science Hub
   - Bomb Squad position
4. Tool records coordinates and shows them on screen
5. Click **"Generate Coordinates"** button
6. Copy the output and provide to administrator

### **Current Coordinates:**
```javascript
'Info center': [308, 163]
'Oil Rafinery 1': [175, 274]
'Field Hospital 1': [167, 475]
'Field Hospital 3': [264, 587]
'Field Hospital 4': [794, 146]
'Field Hospital 2': [930, 247]
'Oil Rafinery 2': [920, 476]
'Science Hub': [820, 600]
```

These are optimized for the 1080px map width.

---

## 📱 **Mobile Usage**

### **On Mobile Devices:**
1. ✅ Open HTML in mobile browser (Safari, Chrome)
2. ✅ Upload Excel from cloud storage (Google Drive, Dropbox)
3. ✅ Download map images to phone
4. ✅ Share images via WhatsApp, Discord, Telegram
5. ✅ View maps in full screen

**Note:** Coordinate picker works best on tablet or desktop with precise cursor control.

---

## 🔐 **Privacy & Security**

- ✅ **100% Local Processing:** All data stays in your browser
- ✅ **No Server:** No data sent to any server
- ✅ **No Tracking:** No analytics or cookies
- ✅ **No Account:** No registration required
- ✅ **Offline Capable:** Works without internet after initial load
- ✅ **No Data Storage:** Files are only processed in memory

**Your player data never leaves your device!**

---

## 🎯 **Best Practices**

### **For Organizers:**
1. **Test with sample data** before using real player lists
2. **Keep backup** of original Excel files
3. **Share templates** with team members early
4. **Verify map outputs** before sharing with team
5. **Download both maps** before closing browser
6. **Update coordinates** if names appear off-position
7. **Check all 20 players** appear on each map

### **For Players:**
1. **Fill Excel accurately** (power, troop type)
2. **Mark availability** clearly (1 or 0)
3. **Update power levels** before each battle
4. **Check your assignment** on the map
5. **Know your building location** on actual map
6. **Understand your priority** (P1 = most important)

### **Before Battle:**
- [ ] Verify all players marked correctly
- [ ] Generate both team maps
- [ ] Check all names appear on maps
- [ ] Share maps in team chat
- [ ] Confirm each player knows their building
- [ ] Have backup plan for no-shows

---

## 🤝 **Support**

### **Having Issues?**
1. Check the troubleshooting section above
2. Open browser console (F12) to see detailed logs
3. Verify Excel template format matches examples
4. Try in a different browser (Chrome recommended)
5. Make sure you have latest version of HTML file

### **Common Console Messages:**
```
✓ "Players loaded: 100" - Excel read successfully
✓ "Team A: 20 | Team B: 20" - Correct player count
✗ "NO PLAYERS!" - Check column F and G markers
✗ "Building not found" - Check building name spelling
```

### **Feature Requests?**
This is a standalone HTML tool. For customization:
1. Edit the HTML file directly (HTML/CSS/JavaScript knowledge required)
2. Use coordinate picker to adjust positions
3. Or request changes from your system administrator

---

## 📄 **Version History**

### **Desert Storm:**
- **v4.0** (Latest)
  - Coordinate picker integration
  - Full name display (no truncation)
  - Dynamic positioning to keep names on screen
  - Checkbox support (1, true, 'Y')
  - Better error handling
  
- **v3.0**
  - Map overlay with player names
  - Color-coded priorities
  - Building coordinate system
  
- **v2.0**
  - Mobile fixes
  - Better Excel handling
  
- **v1.0**
  - Initial release

---

## ⚡ **Performance Tips**

1. **Use latest browser version** for best performance
2. **Close unnecessary tabs** when generating maps
3. **Use desktop/laptop** for optimal experience
4. **Clear browser cache** if experiencing issues
5. **Allow JavaScript** (required for functionality)
6. **Disable ad blockers** if download fails

---

## 🚀 **Getting Started Checklist**

- [ ] Download `desert_storm_FINAL.html`
- [ ] Open in browser to verify it works
- [ ] Download Excel template
- [ ] Fill template with 3-5 test players (mark with 1)
- [ ] Upload and verify map generation
- [ ] Check names appear on buildings correctly
- [ ] Test both Team A and Team B
- [ ] Collect real player data (20 per team)
- [ ] Generate final maps
- [ ] Download both team maps
- [ ] Share with team
- [ ] Battle! 🎮

---

## 📚 **Additional Tools**

### **Included:**
- `desert_storm_FINAL.html` - Main generator
- Excel template (download from HTML)

### **Optional:**
- `coordinate_picker.html` - Position adjustment tool
- Documentation files in `/outputs` folder

---

## 🎮 **Map Reading Guide**

### **For Players:**
When you receive your team map:

1. **Find your name** on the map
2. **Note the color** of your box (indicates priority)
3. **See building location** on the map
4. **Check Bomb Squad** at bottom (if you're assigned there)
5. **Coordinate with building partners** (each building has 2 players)

### **Color Guide:**
- **Dark Red background** = Priority 1 (Bomb Squad) - Roaming support
- **Orange background** = Priority 2 (Refineries/Science Hub) - Key buildings
- **Teal background** = Priority 3 (Field Hospitals) - Support positions
- **Blue background** = Priority 4 (Info Center) - Rear support

### **Bomb Squad Special:**
- 4 highest power players
- Displayed at bottom of map
- Blue boxes with team color text
- "Roam free, help others" instruction

---

## 🎯 **Strategy Tips**

### **Bomb Squad (P1):**
- Strongest players (highest E1 power)
- No fixed position - roam the battlefield
- Help defend any building under attack
- Priority: save critical buildings first

### **Priority 2 Buildings:**
- Second-strongest players
- Hold Oil Refineries and Science Hub
- These are key strategic positions
- 2 players per building for defense

### **Priority 3 Buildings:**
- Balanced power players
- Field Hospitals 1-4
- Support and defense roles
- 2 players per building

### **Priority 4 Buildings:**
- Info Center (rear position)
- 2 players assigned
- Less critical but still important
- Usually safer position

---

## 📞 **Credits**

Developed for competitive Last War: Survival Desert Storm coordination.

**Built with:** HTML5, JavaScript, Canvas API, SheetJS

**Map Source:** Desert Storm official map (scaled and optimized)

**Designed for:** UBS Alliance and competitive Last War: Survival players worldwide

---

## 🎮 **Ready to Battle?**

1. Download `desert_storm_FINAL.html`
2. Prepare your player data (20 per team)
3. Generate both team maps
4. Share with your team
5. Coordinate and dominate Desert Storm! 🏆

---

**Made with ❤️ for competitive Last War: Survival players**

*Last Updated: February 2026*
