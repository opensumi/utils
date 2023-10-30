//@ts-check

const { ProtocolBuilder, serialize, deserialize } = require('..');
const Benchmark = require('benchmark');
const assert = require('assert');

const sample = {
  id: 123456,
  name: 'John Doe',
  email: 'johndoe@example.com',
  age: 30,
  address: {
    street: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    zip: '98765',
  },
  phoneNumbers: [
    {
      type: 'home',
      number: '555-1234',
    },
    {
      type: 'work',
      number: '555-5678',
    },
  ],
  isMarried: true,
  hasChildren: false,
  interests: [
    'reading',
    'hiking',
    'cooking',
    'swimming',
    'painting',
    'traveling',
    'photography',
    'playing music',
    'watching movies',
    'learning new things',
    'spending time with family and friends',
  ],
  education: [
    {
      degree: 'Bachelor of Science',
      major: 'Computer Science',
      university: 'University of California, Los Angeles',
      graduationYear: 2012,
    },
    {
      degree: 'Master of Business Administration',
      major: 'Marketing',
      university: 'Stanford University',
      graduationYear: 2016,
    },
  ],
  workExperience: [
    {
      company: 'Google',
      position: 'Software Engineer',
      startDate: '2012-06-01',
      endDate: '2014-08-31',
    },
    {
      company: 'Apple',
      position: 'Product Manager',
      startDate: '2014-09-01',
      endDate: '2018-12-31',
    },
    {
      company: 'Amazon',
      position: 'Senior Product Manager',
      startDate: '2019-01-01',
      endDate: '2018-12-31',
    },
  ],
  selfIntroduction: `Hi, my name is John Doe and I am a highly motivated and driven individual with a passion for excellence in all areas of my life. I have a diverse background and have gained valuable experience in various fields such as software engineering, product management, and marketing.
  I am a graduate of the University of California, Los Angeles where I received my Bachelor of Science degree in Computer Science. After graduation, I joined Google as a software engineer where I worked on developing innovative products that revolutionized the way people interact with technology.
  With a desire to broaden my skillset, I pursued a Master of Business Administration degree in Marketing from Stanford University. There, I gained a deep understanding of consumer behavior and developed the ability to effectively communicate complex ideas to various stakeholders.
  After completing my MBA, I joined Apple as a product manager where I led the development of several successful products and played a key role in the company's growth. Currently, I am working as a Senior Product Manager at Amazon, where I am responsible for managing a team of product managers and developing cutting-edge products that meet the needs of our customers.
  Aside from my professional life, I am an avid reader, hiker, and cook. I enjoy spending time with my family and friends, learning new things, and traveling to new places. I believe that success is a journey, not a destination, and I am committed to continuously improving myself and achieving excellence in all that I do.
  `,
};

const builder = new ProtocolBuilder({
  type: 'Object',
  name: 'sample',
  fields: [
    {
      name: 'id',
      type: 'UInt32',
    },
    {
      name: 'name',
      type: 'String',
    },
    {
      name: 'email',
      type: 'String',
    },
    {
      name: 'age',
      type: 'UInt32',
    },
    {
      name: 'address',
      type: 'Object',
      fields: [
        {
          name: 'street',
          type: 'String',
        },
        {
          name: 'city',
          type: 'String',
        },
        {
          name: 'state',
          type: 'String',
        },
        {
          name: 'zip',
          type: 'String',
        },
      ],
    },
    {
      name: 'phoneNumbers',
      type: 'Array',
      element: {
        type: 'Object',
        name: 'phoneNumber',
        fields: [
          {
            name: 'type',
            type: 'String',
          },
          {
            name: 'number',
            type: 'String',
          },
        ],
      },
    },
    {
      name: 'isMarried',
      type: 'Boolean',
    },
    {
      name: 'hasChildren',
      type: 'Boolean',
    },
    {
      name: 'interests',
      type: 'Array',
      element: {
        type: 'String',
        name: 'interest',
      },
    },
    {
      name: 'education',
      type: 'Array',
      element: {
        name: 'education',
        type: 'Object',
        fields: [
          {
            name: 'degree',
            type: 'String',
          },
          {
            name: 'major',
            type: 'String',
          },
          {
            name: 'university',
            type: 'String',
          },
          {
            name: 'graduationYear',
            type: 'UInt32',
          },
        ],
      },
    },
    {
      name: 'workExperience',
      type: 'Array',
      element: {
        type: 'Object',
        name: 'workExperience',
        fields: [
          {
            name: 'company',
            type: 'String',
          },
          {
            name: 'position',
            type: 'String',
          },
          {
            name: 'startDate',
            type: 'String',
          },
          {
            name: 'endDate',
            type: 'String',
          },
        ],
      },
    },
    {
      name: 'selfIntroduction',
      type: 'String',
    },
  ],
});

const furyAb = serialize(sample);
const sampleJson = JSON.stringify(sample);

const { encode: protoEncode, decode: protoDecode } = loadProto();

const protobufBf = protoEncode(sample);

function loadProto() {
  const writer = builder.compileWriter();
  const reader = builder.compileReader();
  return {
    encode: (payload) => {
      return writer(payload);
    },
    decode: (buffer) => {
      return reader(buffer);
    },
  };
}

async function start() {
  {
    console.log('json size: ', `${(sampleJson.length / 1000).toFixed()}k`);
    console.log('proto size: ', `${(protobufBf.length / 1000).toFixed()}k`);
    assert(JSON.stringify(protoDecode(protobufBf)) === sampleJson);
    assert.deepEqual(deserialize(furyAb), sample);
  }
  let result = {};

  {
    var suite = new Benchmark.Suite();
    suite
      .add('protocol-less', function () {
        serialize(sample);
      })
      .add('protocol-builder', function () {
        protoEncode(sample);
      })
      .add('json', function () {
        JSON.stringify(sample);
      })
      .on('cycle', function (event) {
        console.log(String(event.target));
      })
      .on('complete', function (e) {
        e.currentTarget.forEach(({ name, hz }) => {
          if (!result[name])
            result[name] = {
              serialize: 0,
              deserialize: 0,
            };

          result[name].serialize = Math.ceil(hz / 10000);
        });
        console.log('Fastest is ' + this.filter('fastest').map('name'));
      })
      .run({ async: false });
  }

  {
    var suite = new Benchmark.Suite();
    suite
      .add('protocol-less', function () {
        deserialize(furyAb);
      })
      .add('protocol-builder', function () {
        protoDecode(protobufBf);
      })
      .add('json', function () {
        JSON.parse(sampleJson);
      })
      .on('cycle', function (event) {
        console.log(String(event.target));
      })
      .on('complete', function (e) {
        e.currentTarget.forEach(({ name, hz }) => {
          if (!result[name])
            result[name] = {
              serialize: 0,
              deserialize: 0,
            };
          result[name].deserialize = Math.ceil(hz / 10000);
        });
        console.log('Fastest is ' + this.filter('fastest').map('name'));
      })
      .run({ async: false });
  }
  console.table(result);
}
start();
