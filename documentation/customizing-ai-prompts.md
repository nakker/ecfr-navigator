# Customizing AI Analysis Prompts

The eCFR Analyzer uses AI to analyze regulatory sections and provide summaries, antiquated scores, and business unfriendliness scores. You can customize the prompts used for these analyses through environment variables.

## Available Prompt Environment Variables

### ANALYSIS_PROMPT_SUMMARY
Controls the prompt used to generate one-sentence summaries of regulatory sections.

**Default prompt:**
```
Read the following regulatory section and provide a one-sentence summary that captures its main requirement or purpose. Be concise and specific.

Section Title: {heading}

Section Content:
{content}

Provide only the one-sentence summary, nothing else.
```

### ANALYSIS_PROMPT_ANTIQUATED
Controls the prompt used to rate how outdated the language and subject matter are on a scale of 1-10.

**Default prompt:**
```
Analyze the following regulatory section and rate how antiquated or out-of-date the language and subject matter is on a scale of 1 to 10.

1 = Very modern, current language and concepts
5 = Somewhat dated but still relevant
10 = Extremely antiquated, uses obsolete terminology or addresses outdated practices

Consider factors like:
- References to outdated technology or practices
- Use of archaic legal language
- Relevance to modern business practices
- Whether the concepts addressed are still applicable today

Section Title: {heading}

Section Content:
{content}

Respond with only a number from 1 to 10.
```

### ANALYSIS_PROMPT_BUSINESS_UNFRIENDLY
Controls the prompt used to rate how burdensome the regulation is to businesses on a scale of 1-10.

**Default prompt:**
```
Analyze the following regulatory section and rate how unfriendly or burdensome it is to businesses on a scale of 1 to 10.

1 = Very business-friendly, minimal burden
5 = Moderate regulatory burden, reasonable requirements
10 = Extremely burdensome, costly or complex compliance requirements

Consider factors like:
- Compliance costs and complexity
- Reporting or documentation requirements
- Restrictions on business operations
- Penalties or enforcement provisions
- Administrative burden

Section Title: {heading}

Section Content:
{content}

Respond with only a number from 1 to 10.
```

## How to Customize Prompts

1. **Create or edit your `.env` file**:
   ```bash
   cp .env.example .env
   ```

2. **Add your custom prompts** to the `.env` file:
   ```env
   # Custom prompt for summaries
   ANALYSIS_PROMPT_SUMMARY="Summarize this regulation in one sentence: {heading} - {content}"
   
   # Custom prompt for antiquated scoring
   ANALYSIS_PROMPT_ANTIQUATED="Rate from 1-10 how outdated this is: {heading} - {content}. Reply with just a number."
   
   # Custom prompt for business burden scoring
   ANALYSIS_PROMPT_BUSINESS_UNFRIENDLY="Rate from 1-10 the business burden: {heading} - {content}. Reply with just a number."
   ```

3. **Restart the data-analysis service**:
   ```bash
   docker-compose restart data-analysis
   ```

## Prompt Variables

Your custom prompts must include these placeholder variables:
- `{heading}` - The section title/heading
- `{content}` - The section content text

These will be replaced with actual values when analyzing each section.

## Best Practices

1. **Keep prompts clear and specific** - The AI performs better with clear instructions
2. **Maintain consistent scoring scales** - If changing scoring prompts, keep the 1-10 scale
3. **Test with a few sections first** - Before running full analysis, test your prompts on a few sections
4. **Include response format instructions** - For scores, specify "Respond with only a number from 1 to 10"

## Triggering Re-analysis

After changing prompts, you'll need to re-analyze sections to see the effects:

1. Go to the Settings page in the UI
2. Click "Force Re-analysis" to re-analyze all sections with your new prompts
3. Or use the API: `POST /api/analysis/trigger?forceReanalysis=true`

## Example: Industry-Specific Prompts

For industry-specific analysis, you might customize prompts like:

```env
# Healthcare-focused prompts
ANALYSIS_PROMPT_BUSINESS_UNFRIENDLY="Rate from 1-10 the compliance burden for healthcare providers, considering HIPAA requirements, patient safety protocols, and clinical documentation requirements: {heading} - {content}. Reply with just a number."

# Financial services prompts  
ANALYSIS_PROMPT_ANTIQUATED="Rate from 1-10 how well this regulation addresses modern fintech, cryptocurrency, and digital banking practices: {heading} - {content}. Reply with just a number where 10 means completely outdated."
```

## Troubleshooting

- **Prompts not updating**: Ensure you've restarted the data-analysis service
- **Invalid scores**: Make sure score prompts ask for numbers 1-10 only
- **Empty summaries**: Check that summary prompts don't have conflicting instructions
- **Rate limiting**: Complex prompts may take longer; adjust `ANALYSIS_BATCH_SIZE` if needed