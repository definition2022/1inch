const { ether, expectRevert, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const ethSigUtil = require('eth-sig-util');
const Wallet = require('ethereumjs-wallet').default;

// const NFTMock = artifacts.require('NFTMock');
const TokenMock = artifacts.require('TokenMock');
const LimitOrderProtocol = artifacts.require('LimitOrderProtocol');
const AggregatorMock = artifacts.require('AggregatorMock');
const DatePriceCalculatorMock = artifacts.require('DatePriceCalculator');
const WhiteListContract = artifacts.require('WhiteListContract');

const { buildOrderData } = require('./helpers/orderUtils');
const { toBN, cutLastArg } = require('./helpers/utils');

describe('NFTickets', async function () {
    let _, wallet;
    const privatekey = '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    const account = Wallet.fromPrivateKey(Buffer.from(privatekey, 'hex'));

    function buildInverseWithSpread (inverse, spread) {
        return toBN(spread).setn(255, inverse).toString();
    }

    // eslint-disable-next-line no-unused-vars
    function buildDoublePriceGetter (swap, oracle1, oracle2, spread, amount = '0') {
        return swap.contract.methods.doublePrice(oracle1.address, oracle2.address, buildInverseWithSpread(false, spread), '0', amount).encodeABI();
    }

    function buildOrder (
        salt,
        makerAsset,
        takerAsset,
        makingAmount,
        takingAmount,
        makerGetter,
        takerGetter,
        allowedSender = constants.ZERO_ADDRESS,
        predicate = '0x',
        permit = '0x',
        interaction = '0x',
    ) {
        return {
            salt: salt,
            makerAsset: makerAsset.address,
            takerAsset: takerAsset.address,
            maker: wallet,
            receiver: constants.ZERO_ADDRESS,
            allowedSender,
            makingAmount,
            takingAmount,
            makerAssetData: '0x',
            takerAssetData: '0x',
            getMakerAmount: makerGetter,
            getTakerAmount: takerGetter,
            predicate,
            permit,
            interaction,
        };
    }

    before(async function () {
        [_, wallet] = await web3.eth.getAccounts();
    });

    beforeEach(async function () {
        this.dai = await TokenMock.new('DAI', 'DAI');
        this.weth = await TokenMock.new('WETH', 'WETH');
        this.inch = await TokenMock.new('1INCH', '1INCH');
        this.NFTicket = await TokenMock.new('Morgenshtern', 'MORG');// await NFTMock.new("Morgenshtern", "MORG");
        
        this.swap = await LimitOrderProtocol.new();
        this.datePriceCalculator = await DatePriceCalculatorMock.new();
        this.whiteListContract = await WhiteListContract.new();

        this.chainId = await this.dai.getChainId();

        await this.dai.mint(wallet, ether('1000000'));
        await this.weth.mint(wallet, ether('1000000'));
        await this.inch.mint(wallet, ether('1000000'));
        await this.dai.mint(_, ether('1000000'));
        await this.weth.mint(_, ether('1000000'));
        await this.inch.mint(_, ether('1000000'));
        await this.NFTicket.mint(wallet, 10);
        // await this.NFTicket.safeMint(wallet, '1');
        // await this.NFTicket.safeMint(wallet, '2');
        // await this.NFTicket.safeMint(wallet, '3');
        // await this.NFTicket.safeMint(wallet, '4');
        // await this.NFTicket.safeMint(wallet, '5');
        // await this.NFTicket.safeMint(wallet, '6');
        // await this.NFTicket.safeMint(wallet, '7');
        // await this.NFTicket.safeMint(wallet, '8');
        // await this.NFTicket.safeMint(wallet, '9');
        // await this.NFTicket.safeMint(wallet, '10');
        const balance = await this.NFTicket.balanceOf(wallet);
        console.log('Issued ' + balance + ' NFT tickets');

        await this.dai.approve(this.swap.address, ether('1000000'));
        await this.weth.approve(this.swap.address, ether('1000000'));
        await this.inch.approve(this.swap.address, ether('1000000'));
        await this.NFTicket.approve(this.swap.address, 10);
        // await this.NFTicket.setApprovalForAll(this.swap.address, true);
        await this.dai.approve(this.swap.address, ether('1000000'), { from: wallet });
        await this.weth.approve(this.swap.address, ether('1000000'), { from: wallet });
        await this.inch.approve(this.swap.address, ether('1000000'), { from: wallet });
        await this.NFTicket.approve(this.swap.address, 10, { from: wallet });

        this.daiOracle = await AggregatorMock.new(ether('0.00025'));
    });

    // Purchase of 2 tickets ( Filled 2 orders)
    it('NFT sell', async function () {
        const makerNFTicket = await this.NFTicket.balanceOf(wallet);
        const takerNFTicket = await this.NFTicket.balanceOf(_);
        const makerWeth = await this.weth.balanceOf(wallet);
        const takerWeth = await this.weth.balanceOf(_);

        for (let i = 0; i < 2; i++) {
            const order = buildOrder(
                i.toString(), this.NFTicket, this.weth, '1'.toString(), ether('1000').toString(), '0x', '0x',
            );
            const data = buildOrderData(this.chainId, this.swap.address, order);
            const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

            await this.swap.fillOrder(order, signature, 0, ether('1000'), 1);
        }

        expect(await this.NFTicket.balanceOf(wallet)).to.be.bignumber.equal(makerNFTicket.sub(web3.utils.toBN('2')));
        expect(await this.NFTicket.balanceOf(_)).to.be.bignumber.equal(takerNFTicket.add(web3.utils.toBN('2')));
        expect(await this.weth.balanceOf(wallet)).to.be.bignumber.equal(makerWeth.add(ether('2000')));
        expect(await this.weth.balanceOf(_)).to.be.bignumber.equal(takerWeth.sub(ether('2000')));
    });

    // Ticket made for specific buyer ( allowedSender )
    describe('VIP ticket', async function () {
        it('should fill with correct taker', async function () {
            const order = buildOrder(
                '1', this.NFTicket, this.weth, '1'.toString(), '1'.toString(), '0x', '0x',
            );
            order.allowedSender = _;
            const data = buildOrderData(this.chainId, this.swap.address, order);
            const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

            const makerNFTicket = await this.NFTicket.balanceOf(wallet);
            const takerNFTicket = await this.NFTicket.balanceOf(_);
            const makerWeth = await this.weth.balanceOf(wallet);
            const takerWeth = await this.weth.balanceOf(_);

            await this.swap.fillOrder(order, signature, 0, 1, 1);

            expect(await this.NFTicket.balanceOf(wallet)).to.be.bignumber.equal(makerNFTicket.sub(web3.utils.toBN('1')));
            expect(await this.NFTicket.balanceOf(_)).to.be.bignumber.equal(takerNFTicket.add(web3.utils.toBN('1')));
            expect(await this.weth.balanceOf(wallet)).to.be.bignumber.equal(makerWeth.add(web3.utils.toBN('1')));
            expect(await this.weth.balanceOf(_)).to.be.bignumber.equal(takerWeth.sub(web3.utils.toBN('1')));
        });

        it('should not fill with incorrect taker', async function () {
            const order = buildOrder(
                '1', this.NFTicket, this.weth, '1'.toString(), '1'.toString(), '0x', '0x',
            );
            order.allowedSender = wallet;
            const data = buildOrderData(this.chainId, this.swap.address, order);
            const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

            await expectRevert(
                this.swap.fillOrder(order, signature, 0, 1, 1),
                'LOP: private order',
            );
        });
    });

    // Variable price depending on the market conditions ( getTakerAmount )
    it('Ticket price protection', async function () {
        const makerAmount = 1;
        const takerAmount = ether('1');
        const order = buildOrder(
            '1', this.NFTicket, this.weth, '1'.toString(), ether('1').toString(), '0x',
            cutLastArg(this.swap.contract.methods.getTakerAmount(makerAmount, takerAmount, 0).encodeABI()),
        );

        const data = buildOrderData(this.chainId, this.swap.address, order);
        const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

        const makerNFTicket = await this.NFTicket.balanceOf(wallet);
        const takerNFTicket = await this.NFTicket.balanceOf(_);
        const makerWeth = await this.weth.balanceOf(wallet);
        const takerWeth = await this.weth.balanceOf(_);

        await this.swap.fillOrder(order, signature, makerAmount, 0, takerAmount.add(ether('0.01')));

        expect(await this.NFTicket.balanceOf(wallet)).to.be.bignumber.equal(makerNFTicket.sub(web3.utils.toBN('1')));
        expect(await this.NFTicket.balanceOf(_)).to.be.bignumber.equal(takerNFTicket.add(web3.utils.toBN('1')));
        expect(await this.weth.balanceOf(wallet)).to.be.bignumber.equal(makerWeth.add(ether(makerAmount.toString())));
        expect(await this.weth.balanceOf(_)).to.be.bignumber.equal(takerWeth.sub(ether(makerAmount.toString())));
    });

    // Sale expiration ( Predicate )
    describe('Ticket sale finish', async function () {
        it('should sell when not finished', async function () {
            const order = buildOrder(
                '1', this.NFTicket, this.weth, '1'.toString(), ether('1000').toString(), '0x', '0x', constants.ZERO_ADDRESS,
                this.swap.contract.methods.timestampBelow(0xff00000000).encodeABI(),
            );
    
            const data = buildOrderData(this.chainId, this.swap.address, order);
            const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });
    
            const makerNFTicket = await this.NFTicket.balanceOf(wallet);
            const takerNFTicket = await this.NFTicket.balanceOf(_);
            const makerWeth = await this.weth.balanceOf(wallet);
            const takerWeth = await this.weth.balanceOf(_);
    
            await this.swap.fillOrder(order, signature, 0, ether('1000'), 1);

            expect(await this.NFTicket.balanceOf(wallet)).to.be.bignumber.equal(makerNFTicket.sub(web3.utils.toBN('1')));
            expect(await this.NFTicket.balanceOf(_)).to.be.bignumber.equal(takerNFTicket.add(web3.utils.toBN('1')));
            expect(await this.weth.balanceOf(wallet)).to.be.bignumber.equal(makerWeth.add(ether('1000')));
            expect(await this.weth.balanceOf(_)).to.be.bignumber.equal(takerWeth.sub(ether('1000')));
        });

        it('should not sell when finished', async function () {
            const order = buildOrder(
                '1', this.NFTicket, this.weth, '1'.toString(), ether('1000').toString(), '0x', '0x', constants.ZERO_ADDRESS,
                this.swap.contract.methods.timestampBelow(0xff0000).encodeABI(),
            );
            const data = buildOrderData(this.chainId, this.swap.address, order);
            const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

            await expectRevert(
                this.swap.fillOrder(order, signature, 0, ether('1000'), 1),
                'LOP: predicate returned false',
            );
        });
    });

    // Price change based on date ( getTakerAmount )
    describe('Ticket sale increase', async function () {
        it('Second butch for x2', async function () {
            const order = buildOrder(
                '1', this.NFTicket, this.weth, '1'.toString(), ether('1000').toString(), '0x',
                cutLastArg(
                    this.swap.contract.methods.arbitraryStaticCall(
                        this.datePriceCalculator.address,
                        cutLastArg(this.datePriceCalculator.contract.methods.singlePrice(0xff0, ether('1000')).encodeABI(), -64))
                        .encodeABI(), -64),
            );

            const data = buildOrderData(this.chainId, this.swap.address, order);
            const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });
    
            const makerNFTicket = await this.NFTicket.balanceOf(wallet);
            const takerNFTicket = await this.NFTicket.balanceOf(_);
            const makerWeth = await this.weth.balanceOf(wallet);
            const takerWeth = await this.weth.balanceOf(_);
    
            await this.swap.fillOrder(order, signature, 1, 0, ether('2000.01'));
    
            expect(await this.NFTicket.balanceOf(wallet)).to.be.bignumber.equal(makerNFTicket.sub(web3.utils.toBN('1')));
            expect(await this.NFTicket.balanceOf(_)).to.be.bignumber.equal(takerNFTicket.add(web3.utils.toBN('1')));
            expect(await this.weth.balanceOf(wallet)).to.be.bignumber.equal(makerWeth.add(ether('2000')));
            expect(await this.weth.balanceOf(_)).to.be.bignumber.equal(takerWeth.sub(ether('2000')));
        });

        it('second batch doesn\'t sell for initial price', async function () {
            const order = buildOrder(
                '1', this.NFTicket, this.weth, '1'.toString(), ether('1000').toString(), '0x',
                cutLastArg(
                    this.swap.contract.methods.arbitraryStaticCall(
                        this.datePriceCalculator.address,
                        cutLastArg(this.datePriceCalculator.contract.methods.singlePrice(0xff0, ether('1000')).encodeABI(), -64))
                        .encodeABI(), -64),
            );
            const data = buildOrderData(this.chainId, this.swap.address, order);
            const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

            await expectRevert(
                this.swap.fillOrder(order, signature, 1, 0, ether('1000.01')),
                'LOP: taking amount too high',
            );
        });
    });

    // Whitelisted buyers get half price ( InteractiveNotificationReceiver )
    it('White list gets discount', async function () {
        const makerNFTicket = await this.NFTicket.balanceOf(wallet);
        const takerNFTicket = await this.NFTicket.balanceOf(_);

        const order = buildOrder(
            '1', this.NFTicket, this.weth, '1'.toString(), ether('1000').toString(), '0x', '0x',
        );
        order.receiver = this.whiteListContract.address;
        // order.interaction = this.whiteListContract.address + _.slice(2);
        const data = buildOrderData(this.chainId, this.swap.address, order);
        const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

        await this.swap.fillOrder(order, signature, 0, ether('1000'), 1);

        expect(await this.NFTicket.balanceOf(wallet)).to.be.bignumber.equal(makerNFTicket.sub(web3.utils.toBN('1')));
        expect(await this.NFTicket.balanceOf(_)).to.be.bignumber.equal(takerNFTicket.add(web3.utils.toBN('1')));
    });
});
