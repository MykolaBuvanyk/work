import React from 'react'
import FAQ from './FAQ'

const items = [
  {
    question: 'faq.question_1',
    answer: [
      'faq.answer_1_1',
      'faq.answer_1_2',
      'faq.answer_1_3',
      { text: 'faq.answer_1_4', links: ['quickGuide'] },
      { text: 'faq.answer_1_5', links: ['contacts'] },
      { text: 'faq.answer_1_6', links: ['home'] },
    ],
  },
  {
    question: 'faq.question_2',
    answer: ['faq.answer_2_1', 'faq.answer_2_2', 'faq.answer_2_3'],
  },
  {
    question: 'faq.question_3',
    answer: [
      'faq.answer_3_1',
      {
        type: 'list',
        items: ['faq.answer_3_list_1', 'faq.answer_3_list_2'],
      },
      'faq.answer_3_2',
      'faq.answer_3_3',
    ],
  },
  {
    question: 'faq.question_4',
    answer: [
      { text: 'faq.answer_4_1', links: ['home'] },
      'faq.answer_4_2',
      {
        type: 'list',
        items: ['faq.answer_4_list_1', 'faq.answer_4_list_2', 'faq.answer_4_list_3'],
      },
      'faq.answer_4_3',
      {
        type: 'list',
        items: [
          'faq.answer_4_list_4',
          { text: 'faq.answer_4_list_5', links: ['quickGuide'] },
          'faq.answer_4_list_6',
        ],
      },
      'faq.answer_4_4',
      {
        type: 'list',
        items: [{ text: 'faq.answer_4_list_7', links: ['contacts'] }, 'faq.answer_4_list_8'],
      },
      { text: 'faq.answer_4_5', links: ['home'] },
    ],
  },
  {
    question: 'faq.question_5',
    answer: [
      { text: 'faq.answer_5_1', links: ['home'] },
      'faq.answer_5_2',
      {
        type: 'list',
        items: ['faq.answer_5_list_1', 'faq.answer_5_list_2', 'faq.answer_5_list_3'],
      },
      { text: 'faq.answer_5_3', links: ['account'] },
    ],
  },
  {
    question: 'faq.question_6',
    answer: [
      { text: 'faq.answer_6_1', links: ['login', 'account', 'home'] },
      'faq.answer_6_2',
      {
        type: 'list',
        items: [
          'faq.answer_6_list_1',
          'faq.answer_6_list_2',
          'faq.answer_6_list_3',
          'faq.answer_6_list_4',
          'faq.answer_6_list_5',
          'faq.answer_6_list_6',
          'faq.answer_6_list_7',
          'faq.answer_6_list_8',
          'faq.answer_6_list_9',
        ],
      },
      { text: 'faq.answer_6_3', links: ['account'] },
    ],
  },
  {
    question: 'faq.question_7',
    answer: [{ text: 'faq.answer_7_1', links: ['contacts'] }, { text: 'faq.answer_7_2', links: ['account'] }],
  },
  {
    question: 'faq.question_8',
    answer: [
      'faq.answer_8_1',
      {
        type: 'list',
        items: ['faq.answer_8_list_1', 'faq.answer_8_list_2', 'faq.answer_8_list_3'],
      },
      { text: 'faq.answer_8_2', links: ['contacts'] },
    ],
  },
  {
    question: 'faq.question_9',
    answer: [
      { text: 'faq.answer_9_1', links: ['home'] },
      {
        type: 'list',
        items: [{ text: 'faq.answer_9_list_1', links: ['account'] }, 'faq.answer_9_list_2'],
      },
      'faq.answer_9_2',
    ],
  },
  {
    question: 'faq.question_10',
    answer: ['faq.answer_10_1', { text: 'faq.answer_10_2', links: ['account'] }, 'faq.answer_10_3'],
  },
  {
    question: 'faq.question_11',
    answer: [
      'faq.answer_11_1',
      'faq.answer_11_2',
      { text: 'faq.answer_11_3', links: ['email'] },
      {
        type: 'list',
        items: [
          'faq.answer_11_list_1',
          'faq.answer_11_list_2',
          'faq.answer_11_list_3',
          'faq.answer_11_list_4',
          'faq.answer_11_list_5',
        ],
      },
      'faq.answer_11_4',
    ],
  },
]

export default function FAQPage() {
  return <FAQ title="faq.title" items={items} />
}
