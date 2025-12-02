Live demo: [https://lara-yeyati-preiss.github.io/anatomy-of-a-horror-hit/](https://lara-yeyati-preiss.github.io/anatomy-of-a-horror-hit)

# Anatomy of a Horror Hit  
**by Lara Yeyati Preiss**  

---

## Concept  
This project explores horror as a cultural barometer—capturing, distorting, and projecting our collective fears back to us.  
Using **Netflix’s Engagement Report (Jan–Jun 2025)**, it examines what the platform’s most-watched horror titles reveal about contemporary anxieties.  

The site unfolds as a scrollytelling narrative. It begins by analyzing the **Hit Matrix**, which visualizes how a hit looks across genres by mapping quadrants defined by **IMDb ratings** (as a proxy for prestige) and **total views** (as a proxy for reach).  
It then zooms in on horror as the poster child of the *“cult corner”*: lower budgets, strong identity, and small but loyal audiences.  
Finally, it traces horror’s **recurring fear patterns**, inviting users to explore them through an **interactive bar chart** that visualizes the genre’s emotional architecture.  

---

## Data & Methods  

**Data sources:**  
- Netflix Engagement Report (Jan–Jun 2025)  
- OMDb API  
- IMDb API  

**Processing:**  
- Film metadata was fetched, cleaned, and processed in Python.  
- Each title was classified by **core fear** using a hybrid process: a local **LLaMA-3 (8B)** model run via **Ollama**, prompted with each film’s title, synopsis, and keywords, guided by a **manually designed taxonomy** and labeled examples of distinct fear categories.  
- Model results were manually reviewed and refined for thematic coherence.  
- Several fear types were consolidated into **three higher-order supergroups**, reflecting broader dimensions of human anxiety.  
- Keyword frequencies were aggregated from IMDb tags to identify the most common thematic vocabularies within each supergroup.
  


<img width="1689" height="877" alt="image" src="https://github.com/user-attachments/assets/10e7fa8f-675e-4a86-9a20-35eb88d4c437" />
<img width="1689" height="877" alt="image" src="https://github.com/user-attachments/assets/ee8da4f7-449e-4504-a43c-be1380a47599" />
<img width="1689" height="877" alt="image" src="https://github.com/user-attachments/assets/c7df3ee5-5c27-45b0-a64a-831472fe922e" />
<img width="1689" height="877" alt="image" src="https://github.com/user-attachments/assets/9b257abd-8d59-446a-921c-b394a23bfa6b" />
<img width="1689" height="877" alt="image" src="https://github.com/user-attachments/assets/f6035f31-941e-4687-a4c8-c5216d843909" />
<img width="1689" height="877" alt="image" src="https://github.com/user-attachments/assets/1aa0e6b3-f8db-4041-89d1-f0706c77496b" />
<img width="1689" height="877" alt="image" src="https://github.com/user-attachments/assets/bc6c8e48-eff9-4279-8e81-0fa2ae7bd5a7" />
<img width="1689" height="877" alt="image" src="https://github.com/user-attachments/assets/ffdee21a-8ac9-428b-a320-825df5a1d849" />
<img width="1689" height="877" alt="image" src="https://github.com/user-attachments/assets/c628c019-ccce-4b46-9727-6b5418f7e12f" />
<img width="1689" height="877" alt="image" src="https://github.com/user-attachments/assets/80aea3ec-f039-4526-8338-31d955e3a36d" />



