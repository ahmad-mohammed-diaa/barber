import { Injectable } from '@nestjs/common';
import { Client, Role, User } from '@prisma/client';
import { hash } from 'bcrypt';
import {
  createTranslation,
  Translation,
} from '../common/class-type/translation';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MockService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly clients = [
    {
      firstName: 'Ahmed',
      lastName: 'Ali',
      phone: '1234567891',
      password: '1234',
      role: 'user',
      referralCode: 'AK3dm3cs',
    },
    {
      firstName: 'Mohamed',
      lastName: 'Hassan',
      phone: '1234567892',
      password: '1234',
      role: 'user',
      referralCode: 'K2skn2nl1',
    },
    {
      firstName: 'Youssef',
      lastName: 'Mahmoud',
      phone: '1234567893',
      password: '1234',
      role: 'user',
      referralCode: 'ak5fn3fs',
    },
    {
      firstName: 'Khaled',
      lastName: 'Mostafa',
      phone: '1234567894',
      password: '1234',
      role: 'user',
      referralCode: 'Af0gn3m2',
    },
    {
      firstName: 'Omar',
      lastName: 'Ibrahim',
      phone: '1234567895',
      password: '1234',
      role: 'user',
      referralCode: 'mASd932j',
    },
    {
      firstName: 'Hossam',
      lastName: 'Adel',
      phone: '1234567896',
      password: '1234',
      role: 'user',
      referralCode: 'ASD9dw2d,',
    },
    {
      firstName: 'Tarek',
      lastName: 'Nasser',
      phone: '1234567897',
      password: '1234',
      role: 'user',
      referralCode: 'ALKSb23da',
    },
    {
      firstName: 'Amr',
      lastName: 'Salem',
      phone: '1234567898',
      password: '1234',
      role: 'user',
      referralCode: '3ffe33',
    },
    {
      firstName: 'Wael',
      lastName: 'Fahmy',
      phone: '1234567899',
      password: '1234',
      role: 'user',
      referralCode: '3Fad3',
    },
    {
      firstName: 'Moustafa',
      lastName: 'Hamed',
      phone: '1234567890',
      password: '1234',
      role: 'user',
      referralCode: 'Fas3gad3',
    },
    {
      firstName: 'Abdelrahman',
      lastName: 'Abdelfattah',
      phone: '01000262238',
      password: '1234',
      role: 'user',
      referralCode: 'nb4nba32r',
    },
  ];

  private readonly admin = [
    {
      firstName: 'Ahmad',
      lastName: 'Hassan',
      phone: '01234567890',
      password: '1234',
      role: 'admin',
    },
    {
      firstName: 'Mohamed',
      lastName: 'Ali',
      phone: '01234567891',
      password: '1234',
      role: 'admin',
    },
    {
      firstName: 'Omar',
      lastName: 'Farouk',
      phone: '01234567892',
      password: '1234',
      role: 'admin',
    },
  ];

  private readonly barbers1 = [
    {
      firstName: 'Khaled',
      lastName: 'Youssef',
      phone: '11234567891',
      avatar:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063667/barber/barbers/whl07h8d9qt5dugpmmtj.webp',
      password: '1234',
      role: 'barber',
      start: 0,
      end: 8,
    },
    {
      firstName: 'Hassan',
      lastName: 'Saad',
      phone: '11234567892',
      avatar:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063667/barber/barbers/d2mfbxmvcqdzvmbe83gm.jpg',
      password: '1234',
      role: 'barber',
      start: 8,
      end: 16,
    },
    {
      firstName: 'Ali',
      lastName: 'Mahmoud',
      phone: '11234567893',
      avatar:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063667/barber/barbers/ung59agowqpun0flfcjd.jpg',
      password: '1234',
      role: 'barber',
      start: 16,
      end: 24,
    },
  ];

  private readonly barbers2 = [
    {
      firstName: 'Tarek',
      lastName: 'Hussein',
      phone: '21234567891',
      avatar:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063667/barber/barbers/ritnqmm7cvvfzpsnkr5o.jpg',
      password: '1234',
      role: 'barber',
      start: 8,
      end: 21,
    },
    {
      firstName: 'Mina',
      lastName: 'Fouad',
      phone: '21234567892',
      avatar:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063667/barber/barbers/jnoy5783pnultmb0n8dl.jpg',
      password: '1234',
      role: 'barber',
      start: 8,
      end: 21,
    },
    {
      firstName: 'Sameh',
      lastName: 'Naguib',
      phone: '21234567893',
      avatar:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063666/barber/barbers/wj2n979pvgbihi2iskut.jpg',
      password: '1234',
      role: 'barber',
      start: 8,
      end: 21,
    },
  ];

  private readonly barbers3 = [
    {
      firstName: 'Ibrahim',
      lastName: 'Kamel',
      phone: '31234567891',
      avatar:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063666/barber/barbers/tdbdaamjh9dpztl0vg5w.webp',
      password: '1234',
      role: 'barber',
      start: 8,
      end: 21,
    },
    {
      firstName: 'Mostafa',
      lastName: 'Gamal',
      phone: '31234567892',
      avatar:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063666/barber/barbers/hvxayxuzelfztf5xc4eo.jpg',
      password: '1234',
      role: 'barber',
      start: 8,
      end: 21,
    },
    {
      firstName: 'Yasser',
      lastName: 'Reda',
      phone: '31234567893',
      avatar:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063666/barber/barbers/p0vvb10opdwxmov0d6yb.jpg',
      password: '1234',
      role: 'barber',
      start: 8,
      end: 21,
    },
  ];

  private readonly branches = [
    {
      translations: [
        { name: 'Al Rehab', language: 'EN' },
        { name: 'الرحاب', language: 'AR' },
      ],
      location: 'Al Rehab',
      phone: '1234567890',
      branchImg:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063015/barber/branches/lwxwydlekw5z4g5smodb.jpg',
      longitude: '31.311891',
      latitude: '30.060032',
    },
    {
      translations: [
        { name: 'Nasr city', language: 'EN' },
        { name: 'مدينة نصر', language: 'AR' },
      ],
      location: 'Madinaty',
      phone: '1234567891',
      branchImg:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063013/barber/branches/s17xflyrpae9zxppb5ki.jpg',
      longitude: '31.311891',
      latitude: '30.060032',
    },
    {
      translations: [
        { name: 'Sheraton', language: 'EN' },
        { name: 'شيراتون', language: 'AR' },
      ],
      location: 'Future City',
      phone: '1234567892',
      branchImg:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063006/barber/branches/cclrcpu45yu2labio03m.jpg',
      longitude: '31.311891',
      latitude: '30.060032',
    },
  ];

  private readonly categories = [
    {
      Translations: [
        { name: 'Hair Care', language: 'EN' },
        { name: 'عناية بالشعر', language: 'AR' },
      ],
    },
    {
      Translations: [
        { name: 'Hair Care', language: 'EN' },
        { name: 'عناية بالشعر', language: 'AR' },
      ],
    },
    {
      Translations: [
        { name: 'Hair Care', language: 'EN' },
        { name: 'عناية بالشعر', language: 'AR' },
      ],
    },
  ];

  private readonly BeardServices = [
    {
      Translation: [
        {
          name: 'Beard Extra',
          language: 'EN',
        },
        {
          name: 'لحية اضافية',
          language: 'AR',
        },
      ],
      price: 100,
      duration: 1,
      serviceImg:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063090/barber/services/xddqtjomejieeehpq0nk.jpg',
    },
    {
      Translation: [
        {
          name: 'Beard Razor',
          language: 'EN',
        },
        {
          name: 'حلاقة لحية',
          language: 'AR',
        },
      ],
      price: 200,
      duration: 2,
      serviceImg:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063090/barber/services/selqadltziifcfahp1pl.jpg',
    },
    {
      Translation: [
        {
          name: 'Beard Straightening',
          language: 'EN',
        },
        {
          name: 'تسريح لحية',
          language: 'AR',
        },
      ],
      price: 300,
      duration: 3,
      serviceImg:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063090/barber/services/hgc9mymn9mlrwrvd8mxg.jpg',
    },
  ];

  private readonly HairCutServices = [
    {
      Translation: [
        {
          name: 'Hair Cut',
          language: 'EN',
        },
        {
          name: 'قص شعر',
          language: 'AR',
        },
      ],
      price: 100,
      duration: 1,
      serviceImg:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063097/barber/services/lwwkcaptr1dnjtgkkfyk.jpg',
    },
    {
      Translation: [
        {
          name: 'Zero Cut',
          language: 'EN',
        },
        {
          name: 'قص شعر صفر',
          language: 'AR',
        },
      ],
      price: 200,
      duration: 2,
      serviceImg:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063098/barber/services/vqypiatj8twlnogeydva.jpg',
    },
    {
      Translation: [
        {
          name: 'Long Hair',
          language: 'EN',
        },
        {
          name: 'تسريح شعر طويل',
          language: 'AR',
        },
      ],
      price: 300,
      duration: 3,
      serviceImg:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063098/barber/services/xtgeqtg39opn8pannpon.jpg',
    },
  ];

  private readonly HairCareServices = [
    {
      Translation: [
        {
          name: 'Hair Dye',
          language: 'EN',
        },
        {
          name: 'صبغة شعر',
          language: 'AR',
        },
      ],
      price: 100,
      duration: 1,
      serviceImg:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063093/barber/services/enmuo5n0ywahae52gcms.jpg',
    },
    {
      Translation: [
        {
          name: 'Hair Relaxer',
          language: 'EN',
        },
        {
          name: 'تنعيم شعر',
          language: 'AR',
        },
      ],
      price: 200,
      duration: 2,
      serviceImg:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063094/barber/services/ljpykqyiixcon4ctwl5g.jpg',
    },
    {
      Translation: [
        {
          name: 'Protein',
          language: 'EN',
        },
        {
          name: 'بروتين',
          language: 'AR',
        },
      ],
      price: 300,
      duration: 3,
      serviceImg:
        'https://res.cloudinary.com/unknowndev/image/upload/v1741063093/barber/services/ehnshculshnphhzsefsq.jpg',
    },
  ];

  async createMockClientData() {
    await this.prisma.order.deleteMany();
    await this.prisma.barber.deleteMany();
    await this.prisma.cashier.deleteMany();
    await this.prisma.branch.deleteMany();
    await this.prisma.service.deleteMany();
    await this.prisma.packagesServices.deleteMany();
    await this.prisma.clientPackages.deleteMany();
    await this.prisma.client.deleteMany();
    await this.prisma.admin.deleteMany();
    await this.prisma.user.deleteMany();
    await this.prisma.category.deleteMany();

    const slot = (start, end) => {
      const slotsArray = [];

      for (let hour = start; hour < end; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
          const slot = `${hour.toString().padStart(2, '0')}:${minute
            .toString()
            .padStart(2, '0')}`;
          slotsArray.push(
            +slot.split(':')[0] > 11
              ? (+slot.split(':')[0] - 12 === 0 ? 12 : +slot.split(':')[0] - 12)
                  .toString()
                  .padStart(2, '0') +
                  ':' +
                  slot.split(':')[1] +
                  ' PM'
              : slot + ' AM',
          );
        }
      }

      return { slotsArray };
    };

    const client = this.clients.map(async (client) => {
      client;
      await this.prisma.user.create({
        data: {
          firstName: client.firstName,
          lastName: client.lastName,
          password: await hash(client.password, 10),
          phone: client.phone,
          role: Role[client.role.toUpperCase()],
          avatar: `https://avatar.iran.liara.run/public/boy?username=${client.firstName + client.lastName}`,
          client: {
            create: {
              referralCode: client.referralCode,
            },
          },
        },
      });

      return client;
    });

    const admins = this.admin.map(async (admin) => {
      await this.prisma.user.create({
        data: {
          firstName: admin.firstName,
          lastName: admin.lastName,
          password: await hash(admin.password, 10),
          phone: admin.phone,
          role: Role[admin.role.toUpperCase()],
          avatar: `https://avatar.iran.liara.run/public/boy?username=${admin.firstName + admin.lastName}`,

          admin: {
            create: {},
          },
        },
      });

      return admin;
    });

    const branchPromises = this.branches.map(async (branch) => {
      const createdBranch = await this.prisma.branch.create({
        data: {
          latitude: branch.latitude,
          longitude: branch.longitude,
          Translation: createTranslation({ Translation: branch.translations }),
          location: branch.location,
          phone: branch.phone,
          branchImg: branch.branchImg,
        },
      });
      return createdBranch;
    });

    const createdBranches = await Promise.all(branchPromises);

    const barber1 = this.barbers1.map(async (barber) => {
      await this.prisma.user.create({
        data: {
          firstName: barber.firstName,
          lastName: barber.lastName,
          password: await hash(barber.password, 10),
          phone: barber.phone,
          role: Role[barber.role.toUpperCase()],
          avatar: barber.avatar,
          barber: {
            create: {
              rate: 0,
              Slot: {
                create: {
                  slot: slot(barber.start, barber.end).slotsArray,
                  end: barber.end,
                  start: barber.start,
                },
              },
              branchId: createdBranches[0].id,
            },
          },
        },
      });
    });
    const barber2 = this.barbers2.map(async (barber) => {
      await this.prisma.user.create({
        data: {
          firstName: barber.firstName,
          lastName: barber.lastName,
          password: await hash(barber.password, 10),
          phone: barber.phone,
          role: Role[barber.role.toUpperCase()],
          avatar: barber.avatar,
          barber: {
            create: {
              rate: 0,
              Slot: {
                create: {
                  slot: slot(barber.start, barber.end).slotsArray,
                  end: barber.end,
                  start: barber.start,
                },
              },
              branchId: createdBranches[1].id,
            },
          },
        },
      });
    });
    const barber3 = this.barbers3.map(async (barber) => {
      await this.prisma.user.create({
        data: {
          firstName: barber.firstName,
          lastName: barber.lastName,
          password: await hash(barber.password, 10),
          phone: barber.phone,
          role: Role[barber.role.toUpperCase()],
          avatar: barber.avatar,
          barber: {
            create: {
              rate: 0,
              Slot: {
                create: {
                  slot: slot(barber.start, barber.end).slotsArray,
                  end: barber.end,
                  start: barber.start,
                },
              },
              branchId: createdBranches[2].id,
            },
          },
        },
      });
    });

    const category = this.categories.map(async (category) => {
      const c = await this.prisma.category.create({
        data: {
          Translation: createTranslation({
            Translation: category.Translations,
          }),
        },
      });
      return c;
    });
    const createdCategories = await Promise.all(category);

    const serviceBeard = this.BeardServices.map(async (service) => {
      await this.prisma.service.create({
        data: {
          Translation: createTranslation({ Translation: service.Translation }),
          price: service.price,
          duration: service.duration,
          categoryId: createdCategories[1].id,
          serviceImg: service.serviceImg,
        },
      });
    });
    const serviceCare = this.HairCareServices.map(async (service) => {
      await this.prisma.service.create({
        data: {
          Translation: createTranslation({ Translation: service.Translation }),
          price: service.price,
          duration: service.duration,
          categoryId: createdCategories[0].id,
          serviceImg: service.serviceImg,
        },
      });
    });
    const serviceCut = this.HairCutServices.map(async (service) => {
      await this.prisma.service.create({
        data: {
          Translation: createTranslation({ Translation: service.Translation }),
          price: service.price,
          duration: service.duration,
          categoryId: createdCategories[2].id,
          serviceImg: service.serviceImg,
        },
      });
    });

    const settings = await this.prisma.settings.create({
      data: {
        canceledOrder: 2,
        pointLimit: 100,
        PointsPercentage: 10,
        referralPoints: 1000,
      },
    });

    return {
      settings,
      client,
      admins,
      barber1,
      barber2,
      barber3,
      category,
      serviceBeard,
      serviceCare,
      serviceCut,
    };
  }
}
