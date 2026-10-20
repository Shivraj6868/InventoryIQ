# InventoryIQ

# 📦 Interactive Product Inventory & Analytics Dashboard

An intuitive, feature-rich web application for tracking product inventory, performing real-time financial calculations (taxes and discounts), and analyzing pricing metrics. Built to demonstrate core JavaScript concepts, modern UI aesthetics, and dynamic data management.

## 🚀 Live Demo

🔗 [**Click Here to View Live Demo**](https://inventoryiq-dusky.vercel.app/)

## 📸 Screenshots

### 📊 Dashboard Overview
<img width="1262" height="635" alt="image" src="https://github.com/user-attachments/assets/d3d1e06c-ead1-438a-bd9a-4515e02a0ff8" />

### ➕ Add Product & Tax Calculator
<img width="1238" height="395" alt="image" src="https://github.com/user-attachments/assets/d9a61f4e-7812-4331-8019-8a79b79e5f45" />

### 📋 Inventory Table
<img width="1229" height="617" alt="image" src="https://github.com/user-attachments/assets/20bfdd83-3905-4db6-bbf2-398a7df25424" />

### 📈 Analytics & Reports
<img width="1246" height="495" alt="image" src="https://github.com/user-attachments/assets/b49e6d46-059d-4eda-a524-c4c565ef040a" />

## ✨ Features

- **📊 Dynamic Dashboard Summary:** Instantly track total inventory value, average product price, total product count, and product tier distribution (Budget vs. Premium).
- **➕ Product Management:** Add products manually or through prompt input dialogs with automatically calculated categories.
- **🏷️ Automated Categorization:** Classifies products into:
  - **Budget:** Products priced below ₹1,000.
  - **Premium:** Products priced at ₹1,000 or above.
- **🧮 Tax & Discount Calculator:** Performs sequential calculations:
  Original Price → Apply Discount → Calculate Tax → Final Amount.
- **🔍 Smart Search & Filtering:** Filter inventory by product name or category in real time.
- **📈 Analytics & Report Generator:** Identifies the highest- and lowest-priced products, calculates price differences, displays category distribution, and generates summary reports.
- **🔄 Reset to Sample Data:** Restore default products with a single click for testing.

## 🛠️ Core Technical Implementation

This project was developed as a **Capstone Mini Project**, showcasing essential JavaScript fundamentals.

### 1. Data & Input Initialization
- Accepts user input using `prompt()` with explicit type conversion.
- Stores dynamic data using arrays of objects alongside default values.

### 2. Control Flow & Conditional Evaluation
- Uses `if...else` and `switch` statements for data validation and threshold-based product categorization.

### 3. Loops & Flow Control
- Uses `for`, `forEach()`, and `filter()` to iterate through inventory data.
- Applies `break` and `continue` where appropriate to control loops and handle invalid or missing inputs.

### 4. Functions & Scope
- Uses standard functions and modern arrow functions (`=>`) for aggregate metrics, discount and tax calculations, and variable scoping.

## 💻 Tech Stack

- **Frontend:** HTML5, CSS3, CSS, JavaScript (ES6+).
- **Icons & UI:** Modern gradient layouts, rounded UI components, and clean typography.
