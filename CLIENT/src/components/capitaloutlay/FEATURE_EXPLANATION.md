# Capital Outlay Table Features Explanation

## 🔧 Toggle Compact View - Para saan ito?

### **Purpose (Layunin):**
Ang **Compact View** ay ginawa para sa mga users na gusto ng **mas maraming data na makita sa screen** nang hindi kailangan mag-scroll.

### **What it does (Ginagawa nito):**

#### **Normal View (Default):**
- Standard row heights (normal spacing)
- Regular font sizes (14px)
- Comfortable padding (10px-14px)
- Easy to read and click

#### **Compact View (When toggled ON):**
- **Smaller row heights** - mas mababaw ang mga rows
- **Smaller fonts** (12px) - mas maliit ang text
- **Tighter padding** (6px-10px) - mas dikit ang content
- **More data visible** - mas maraming items na makikita sa screen
- **Space-efficient** - mas tipid sa space

### **Kailan gamitin:**
- Kapag maraming data at gusto mo makita lahat
- Kapag may maliit na screen (laptop, tablet)
- Kapag gusto mo ng "overview" ng lahat ng data
- Para sa power users na sanay sa dense interfaces

### **How to use:**
1. Click ang **compact view icon** (ExpandLess/ExpandMore) sa toolbar
2. Makikita mo agad na mag-shrink ang table
3. Click ulit para bumalik sa normal view

---

## 📁 Accordion Functionality - Bakit nawala at paano na-restore?

### **What happened (Nangyari):**
Nung nag-enhance ako ng table, accidentally na-remove ko ang accordion functionality. Sorry! 😅

### **What is Accordion (Ano ang Accordion):**
Ang accordion ay **collapsible categories** - pwede mo i-expand o i-collapse ang bawat category.

### **Restored Features:**

#### **1. Category Headers with Toggle:**
- **Clickable headers** - click mo ang category name para i-expand/collapse
- **Arrow icons** - ExpandMore (▼) para sa collapsed, ExpandLess (▲) para sa expanded
- **Hover effect** - mag-darken ang header kapag naka-hover

#### **2. Individual Category Control:**
- **Per-category toggle** - pwede mo i-collapse ang isa habang expanded ang iba
- **Visual feedback** - makikita mo agad kung expanded o collapsed
- **Smooth animation** - may transition effect

#### **3. Expand All / Collapse All Button:**
- **Master control** - isang click para sa lahat ng categories
- **Smart button text** - "Expand All" o "Collapse All" depende sa current state
- **Efficient workflow** - para sa mga users na gusto ng bulk actions

#### **4. Default State:**
- **All expanded by default** - lahat ng categories ay naka-expand pagka-load
- **User preference** - based sa feedback na gusto mo makita lahat agad

### **Benefits ng Accordion:**

#### **For Organization:**
- **Cleaner interface** - hindi overwhelming ang data
- **Focused viewing** - pwede mo i-focus sa specific category lang
- **Better navigation** - easier to find specific categories

#### **For Performance:**
- **Faster rendering** - collapsed categories hindi nire-render ang content
- **Less scrolling** - mas konti ang need i-scroll
- **Better mobile experience** - mas mobile-friendly

#### **For User Experience:**
- **Customizable view** - user controls kung ano ang gusto niya makita
- **Progressive disclosure** - show only what's needed
- **Reduced cognitive load** - hindi overwhelming ang information

### **How to use Accordion:**

#### **Method 1: Individual Category Control**
1. Click ang **category header** (green bar with category name)
2. Makikita mo ang **arrow icon** na mag-rotate
3. Ang category content ay mag-collapse o mag-expand

#### **Method 2: Bulk Control**
1. Click ang **"Expand All" / "Collapse All"** button sa toolbar
2. Lahat ng categories ay mag-expand o mag-collapse sabay-sabay

#### **Method 3: Arrow Icon**
1. Click directly ang **arrow icon** sa category header
2. Same effect sa pag-click ng header

---

## 🎯 Combined Benefits

### **Compact View + Accordion = Power User Experience:**

#### **Scenario 1: Data Overview**
- Enable **Compact View** para makita ang mas maraming data
- Use **Expand All** para makita lahat ng categories
- Perfect para sa **reporting** at **data analysis**

#### **Scenario 2: Focused Work**
- Keep **Normal View** para sa comfortable editing
- **Collapse** ang hindi needed na categories
- **Expand** lang ang category na ginagawa mo
- Perfect para sa **data entry** at **editing**

#### **Scenario 3: Mobile/Small Screen**
- Enable **Compact View** para sa space efficiency
- Use **accordion** para sa better navigation
- Perfect para sa **mobile users** at **small laptops**

---

## 🔄 Toggle States Summary

### **Compact View Toggle:**
- **OFF (Default)**: Normal spacing, comfortable view
- **ON**: Tight spacing, more data visible

### **Column Totals Toggle:**
- **ON (Default)**: Show totals in headers
- **OFF**: Hide totals for cleaner look

### **Accordion State:**
- **All Expanded (Default)**: All categories visible
- **Mixed**: Some expanded, some collapsed
- **All Collapsed**: Only headers visible

---

## 💡 Pro Tips

### **For Efficiency:**
1. Use **Compact View** + **Expand All** para sa quick overview
2. Use **Normal View** + **Selective Expand** para sa focused work
3. Use **Column Totals OFF** + **Compact View** para sa maximum data density

### **For Different Tasks:**
- **Data Entry**: Normal View, Expand only current category
- **Review/Audit**: Compact View, Expand All
- **Presentation**: Normal View, Expand relevant categories only
- **Mobile**: Compact View, Accordion navigation

Ngayon mas clear na kung para saan ang bawat feature! 🎉
