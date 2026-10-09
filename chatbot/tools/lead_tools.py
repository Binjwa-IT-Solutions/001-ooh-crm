from langchain_core.tools import tool
import adapters.lead_adapter as lead_adapter

@tool
def add_lead(name: str, email: str, phone: str, city: str, budget: float) -> dict:
    """
    Records a new conversational lead.
    You must collect the client's name, email, phone, city of interest, and budget.
    """
    return lead_adapter.add_lead(name, email, phone, city, budget)

@tool
def get_leads(assigned_to: str = None, status: str = None) -> dict:
    """
    Get a list of leads from the database. Returns both the leads and the total count of leads.
    Optionally filter by 'assigned_to' (using employee_id) or 'status' (e.g. New, Contacted, Converted).
    """
    return lead_adapter.get_leads(assigned_to, status)

@tool
def update_lead(lead_id: str, status: str = None, city: str = None, budget: float = None) -> dict:
    """
    Update an existing lead's details.
    You must provide the 'lead_id'. Optionally update 'status' (New, Contacted, Qualified, Converted, Lost), 'city', or 'budget'.
    """
    return lead_adapter.update_lead(lead_id, status, city, budget)

@tool
def claim_lead(lead_id: str, user_id: str) -> dict:
    """
    Claim an unclaimed lead for a sales agent.
    You must provide the 'lead_id' and the 'user_id' of the agent claiming it.
    """
    return lead_adapter.claim_lead(lead_id, user_id)

@tool
def generate_lead_source_image() -> dict:
    """
    Generate a comprehensive, colorful analytical image summarizing lead data.
    This dashboard includes:
    1. Lead Distribution by Source (Count and Percentage)
    2. Total Pipeline Value / Budget Contribution by Source
    3. Lead Distribution by City/Site
    """
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import os
        import uuid
        from datetime import datetime
        from collections import Counter, defaultdict
        from data.db_client import db
        import re
        
        leads = list(db["leads"].find({}))
        
        sources = [lead.get('source', 'Unknown') for lead in leads]
        source_counts = Counter(sources)
        
        budget_by_source = defaultdict(float)
        for l in leads:
            s = l.get('source', 'Unknown')
            # Extract budget safely
            b = l.get('budget')
            if isinstance(b, str):
                b = re.sub(r'[^0-9.]', '', b)
                try: b = float(b) if b else 0
                except: b = 0
            elif b is None:
                b = 0
            budget_by_source[s] += float(b)
            
        cities = [str(l.get('city') or 'Unknown').title().strip() for l in leads]
        city_counts = Counter(cities)
        
        # Plotting
        fig = plt.figure(figsize=(20, 12), facecolor='#f8fafc')
        fig.suptitle('MEDIA OCTUS — Lead Analytics Dashboard', fontsize=24, fontweight='bold', color='#0f172a', y=0.96)
        
        colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#64748b']
        
        # --- Panel 1: Source Donut ---
        ax1 = plt.subplot(2, 2, 1)
        labels1 = list(source_counts.keys())
        sizes1 = list(source_counts.values())
        
        def make_autopct(values):
            def my_autopct(pct):
                val = int(round(pct*sum(values)/100.0))
                return f'{pct:.1f}%\n({val})'
            return my_autopct
            
        ax1.pie(sizes1, labels=labels1, autopct=make_autopct(sizes1),
                startangle=140, colors=colors[:len(labels1)],
                textprops=dict(color="#1e293b", fontweight='bold'),
                wedgeprops=dict(width=0.4, edgecolor='white', linewidth=2))
        centre_circle = plt.Circle((0,0),0.70,fc='#f8fafc')
        ax1.add_artist(centre_circle)
        ax1.set_title('Leads by Source', fontsize=16, fontweight='bold', color='#1e293b', pad=15)
        ax1.text(0, 0, f'Total Leads\n{sum(sizes1)}', ha='center', va='center', fontsize=14, fontweight='bold', color='#475569')
        
        # --- Panel 2: Budget by Source ---
        ax2 = plt.subplot(2, 2, 2)
        sources2 = list(budget_by_source.keys())
        budgets2 = list(budget_by_source.values())
        
        bars = ax2.bar(sources2, budgets2, color=colors[:len(sources2)])
        ax2.set_title('Pipeline Budget by Source (₹)', fontsize=16, fontweight='bold', color='#1e293b', pad=15)
        ax2.set_ylabel('Budget (INR)', fontsize=12, color='#475569')
        ax2.spines['top'].set_visible(False)
        ax2.spines['right'].set_visible(False)
        for bar in bars:
            yval = bar.get_height()
            ax2.text(bar.get_x() + bar.get_width()/2, yval + (max(budgets2)*0.02 if max(budgets2)>0 else 1), f'₹{yval:,.0f}', ha='center', va='bottom', fontsize=10, fontweight='bold', color='#334155')

        # --- Panel 3: Leads by City ---
        ax3 = plt.subplot(2, 1, 2)
        top_cities = city_counts.most_common(12)
        cities3 = [x[0] for x in top_cities]
        counts3 = [x[1] for x in top_cities]
        
        bars3 = ax3.bar(cities3, counts3, color='#6366f1')
        ax3.set_title('Top Lead Sites / Cities', fontsize=16, fontweight='bold', color='#1e293b', pad=15)
        ax3.set_ylabel('Number of Leads', fontsize=12, color='#475569')
        ax3.spines['top'].set_visible(False)
        ax3.spines['right'].set_visible(False)
        ax3.tick_params(axis='x', rotation=0)
        for bar in bars3:
            yval = bar.get_height()
            ax3.text(bar.get_x() + bar.get_width()/2, yval + (max(counts3)*0.02), f'{yval}', ha='center', va='bottom', fontsize=10, fontweight='bold', color='#334155')
            
        plt.tight_layout(pad=4.0)
        
        charts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "charts")
        os.makedirs(charts_dir, exist_ok=True)
        filename = f"lead_source_{uuid.uuid4().hex[:8]}.png"
        filepath = os.path.join(charts_dir, filename)
        fig.savefig(filepath, dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
        plt.close(fig)

        return {
            "status": "success",
            "message": f"Lead source distribution image generated successfully based on {sum(sizes1)} leads.",
            "image_url": f"/charts/{filename}"
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}
