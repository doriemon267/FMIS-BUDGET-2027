/**
 * FAQ Component
 */

import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const FAQ = ({ items = [] }) => {
  const defaultFAQs = [
    {
      question: 'How do I create a new proposal?',
      answer: 'Click on "Create Proposal" button, fill in the required fields, and submit. Make sure you have selected the correct fiscal year and region.',
    },
    {
      question: 'What is the difference between Initial, NEP, and GAA proposals?',
      answer: 'Initial proposals are the first budget submissions. NEP (National Expenditure Program) proposals are created after Initial proposals are finalized, with ceiling constraints. GAA (General Appropriations Act) is the final approved budget.',
    },
    {
      question: 'How do I track my proposal status?',
      answer: 'Go to "My Proposals" or "All Proposals" page. You can see the current status and workflow history for each proposal.',
    },
    {
      question: 'What happens if my proposal exceeds the NEP ceiling?',
      answer: 'The system will show a warning alert. You need to adjust your budget amounts to stay within the assigned ceiling before you can submit.',
    },
    {
      question: 'Can I edit a proposal after submission?',
      answer: 'It depends on the current status. Draft proposals can be edited freely. Once submitted, only reviewers and approvers can make changes based on their role permissions.',
    },
    {
      question: 'How do I view the Tier version used in a workflow action?',
      answer: 'Open the proposal, click "View History", and check the "Tier Version" column. This shows which Tier version was active when each action was performed.',
    },
  ];

  const faqs = items.length > 0 ? items : defaultFAQs;

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        Frequently Asked Questions
      </Typography>
      {faqs.map((faq, index) => (
        <Accordion key={index} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight="medium">
              {faq.question}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              {faq.answer}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default FAQ;
